import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { EOBData, EOBLineItem } from "@shared/schema";
import OpenAI from "openai";
import { authenticateSupabase, AuthUser } from "../middleware/supabaseAuth";

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// Middleware to verify authentication and Pro/Family plan
async function requireProPlan(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated
  const authUser = (req as any).user as AuthUser | undefined;
  
  if (!authUser) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Please log in to access EOB features'
    });
  }
  
  const userId = authUser.id;
  const currentPlan = authUser.currentPlan;
  
  // Check if user has Pro or Family plan
  if (currentPlan !== 'pro' && currentPlan !== 'family') {
    return res.status(403).json({ 
      error: 'Upgrade required',
      message: 'EOB Analyzer features require Pro or Family plan',
      currentPlan
    });
  }
  
  // Attach user info to request for use in handlers
  (req as any).userId = userId;
  (req as any).currentPlan = currentPlan;
  next();
}

// Export EOB line items as CSV
router.get('/:documentId/export-csv', authenticateSupabase, requireProPlan, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).userId;
    
    const document = await storage.getDocument(documentId);
    
    // Verify document exists and is an EOB
    if (!document || !document.eobData) {
      return res.status(404).json({ error: 'EOB document not found' });
    }
    
    // SECURITY: Verify document ownership (sessionId should match userId)
    if (document.sessionId !== userId) {
      console.log(`Access denied: User ${userId} attempted to access document ${documentId} owned by ${document.sessionId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this document'
      });
    }
    
    const eobData = document.eobData as unknown as EOBData;
    
    // Generate CSV content
    const headers = [
      'Service Date',
      'Provider',
      'Procedure Code',
      'Procedure Description',
      'Diagnosis Code',
      'Billed Amount',
      'Allowed Amount',
      'Plan Paid',
      'Patient Responsibility',
      'Deductible',
      'Copay',
      'Coinsurance',
      'Not Covered',
      'Denial Code',
      'Denial Reason'
    ];
    
    const csvRows = [headers.join(',')];
    
    eobData.lineItems.forEach(item => {
      const row = [
        item.serviceDate,
        `"${item.provider.replace(/"/g, '""')}"`,
        item.procedureCode,
        `"${item.procedureDescription.replace(/"/g, '""')}"`,
        item.diagnosisCode || '',
        item.billedAmount.toFixed(2),
        item.allowedAmount.toFixed(2),
        item.planPaid.toFixed(2),
        item.patientResponsibility.toFixed(2),
        (item.deductible || 0).toFixed(2),
        (item.copay || 0).toFixed(2),
        (item.coinsurance || 0).toFixed(2),
        (item.notCovered || 0).toFixed(2),
        item.denialCode || '',
        item.denialReason ? `"${item.denialReason.replace(/"/g, '""')}"` : ''
      ];
      csvRows.push(row.join(','));
    });
    
    // Add summary row
    csvRows.push('');
    csvRows.push('SUMMARY');
    csvRows.push(`Total Billed,,,,,${eobData.financialSummary.totalBilled.toFixed(2)}`);
    csvRows.push(`Total Allowed,,,,,${eobData.financialSummary.totalAllowed.toFixed(2)}`);
    csvRows.push(`Total Plan Paid,,,,,${eobData.financialSummary.totalPlanPaid.toFixed(2)}`);
    csvRows.push(`Total Patient Responsibility,,,,,${eobData.financialSummary.totalPatientResponsibility.toFixed(2)}`);
    
    const csvContent = csvRows.join('\n');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="eob-${eobData.claimNumber}-${Date.now()}.csv"`);
    res.send(csvContent);
    
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Generate appeal letter for disputed claims
router.get('/:documentId/generate-appeal', authenticateSupabase, requireProPlan, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = (req as any).userId;
    
    const document = await storage.getDocument(documentId);
    
    // Verify document exists and is an EOB
    if (!document || !document.eobData) {
      return res.status(404).json({ error: 'EOB document not found' });
    }
    
    // SECURITY: Verify document ownership (sessionId should match userId)
    if (document.sessionId !== userId) {
      console.log(`Access denied: User ${userId} attempted to access document ${documentId} owned by ${document.sessionId}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'You do not have permission to access this document'
      });
    }
    
    const eobData = document.eobData as unknown as EOBData;
    
    // Find issues that warrant appeals
    const appealableIssues = eobData.issues.filter(issue => 
      issue.type === 'denial' || 
      issue.type === 'duplicate_billing' || 
      issue.type === 'out_of_network'
    );
    
    if (appealableIssues.length === 0) {
      return res.status(400).json({ 
        error: 'No appealable issues found',
        message: 'This EOB does not contain any denials, duplicate billings, or out-of-network issues that can be appealed.'
      });
    }
    
    // Generate appeal letter using OpenAI
    const prompt = `Generate a professional medical billing appeal letter based on the following information:

INSURANCE INFORMATION:
- Insurance Company: ${eobData.payerName}
- Member Name: ${eobData.memberName}
- Member ID: ${eobData.memberId}
- Claim Number: ${eobData.claimNumber}
- Service Date: ${eobData.serviceStartDate}

ISSUES TO APPEAL:
${appealableIssues.map((issue, idx) => `
${idx + 1}. ${issue.title}
   Description: ${issue.description}
   ${issue.potentialSavings ? `Disputed Amount: $${issue.potentialSavings.toFixed(2)}` : ''}
`).join('\n')}

LINE ITEMS AFFECTED:
${eobData.lineItems
  .filter(item => appealableIssues.some(issue => issue.affectedLineItems?.includes(item.id)))
  .map(item => `- ${item.serviceDate}: ${item.procedureDescription} (${item.procedureCode}) - $${item.patientResponsibility.toFixed(2)}`)
  .join('\n')}

Generate a formal appeal letter that:
1. States the claim number and service dates
2. Explains each issue clearly and professionally
3. Requests a review of the claim
4. Asks for a response within 30 days
5. Includes a closing requesting reconsideration

Format the letter professionally with proper sections and placeholders for [MEMBER NAME] and [DATE].`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional medical billing advocate who writes clear, formal appeal letters for insurance claims.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });
    
    const appealLetter = response.choices[0]?.message?.content || 'Failed to generate appeal letter';
    
    // Return as downloadable text file
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="appeal-letter-claim-${eobData.claimNumber}-${Date.now()}.txt"`);
    res.send(appealLetter);
    
  } catch (error) {
    console.error('Appeal generation error:', error);
    res.status(500).json({ error: 'Failed to generate appeal letter' });
  }
});

export default router;
