import OpenAI from 'openai';
import { EOBData, EOBLineItem, EOBFinancialSummary, EOBIssue } from '@shared/schema';
import { nanoid } from 'nanoid';

export class EOBExtractionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async extractEOBData(documentText: string): Promise<EOBData> {
    const prompt = `You are an expert medical billing analyst. Extract structured data from this Explanation of Benefits (EOB) document.

IMPORTANT: Return ONLY valid JSON with no markdown formatting, no code blocks, no extra text.

Extract the following information and return as a JSON object:

{
  "payerName": "Insurance company name",
  "payerAddress": "Insurance company address if found",
  "payerPhone": "Insurance company phone if found",
  "memberName": "Patient/member name",
  "memberId": "Member/subscriber ID",
  "groupNumber": "Group number if found",
  "claimNumber": "Claim number",
  "claimDate": "Claim date (YYYY-MM-DD format)",
  "processedDate": "Processed date (YYYY-MM-DD format)",
  "providerName": "Healthcare provider name",
  "providerNPI": "Provider NPI if found",
  "serviceStartDate": "Service start date (YYYY-MM-DD)",
  "serviceEndDate": "Service end date (YYYY-MM-DD)",
  "lineItems": [
    {
      "serviceDate": "YYYY-MM-DD",
      "provider": "Provider name",
      "procedureCode": "CPT/HCPCS code",
      "procedureDescription": "Procedure description",
      "diagnosisCode": "ICD code if found",
      "diagnosisDescription": "Diagnosis description if found",
      "billedAmount": 0.00,
      "allowedAmount": 0.00,
      "planPaid": 0.00,
      "patientResponsibility": 0.00,
      "deductible": 0.00,
      "copay": 0.00,
      "coinsurance": 0.00,
      "notCovered": 0.00,
      "denialCode": "Denial code if denied",
      "denialReason": "Denial reason if denied"
    }
  ]
}

For each line item:
- Extract ALL monetary amounts as numbers (not strings)
- Calculate patientResponsibility = deductible + copay + coinsurance + notCovered
- Include denial information if the claim was denied or partially denied

DOCUMENT TEXT:
${documentText}

Return ONLY the JSON object, no other text.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a medical billing data extraction expert. Extract structured EOB data and return ONLY valid JSON with no markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      });

      const content = response.choices[0].message.content || '{}';
      
      let jsonContent = content.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/```\n?/, '').replace(/\n?```$/, '');
      }
      
      const extractedData = JSON.parse(jsonContent);
      
      const lineItems: EOBLineItem[] = (extractedData.lineItems || []).map((item: any) => ({
        id: nanoid(),
        serviceDate: item.serviceDate || '',
        provider: item.provider || extractedData.providerName || '',
        procedureCode: item.procedureCode || '',
        procedureDescription: item.procedureDescription || '',
        diagnosisCode: item.diagnosisCode,
        diagnosisDescription: item.diagnosisDescription,
        billedAmount: Number(item.billedAmount) || 0,
        allowedAmount: Number(item.allowedAmount) || 0,
        planPaid: Number(item.planPaid) || 0,
        patientResponsibility: Number(item.patientResponsibility) || 0,
        deductible: item.deductible ? Number(item.deductible) : undefined,
        copay: item.copay ? Number(item.copay) : undefined,
        coinsurance: item.coinsurance ? Number(item.coinsurance) : undefined,
        notCovered: item.notCovered ? Number(item.notCovered) : undefined,
        denialCode: item.denialCode,
        denialReason: item.denialReason,
      }));
      
      const financialSummary = this.calculateFinancialSummary(lineItems);
      
      const plainLanguageSummary = this.generatePlainLanguageSummary(financialSummary);
      
      const issues = this.detectIssues(lineItems, financialSummary, extractedData);
      
      const eobData: EOBData = {
        payerName: extractedData.payerName || 'Unknown Insurance Company',
        payerAddress: extractedData.payerAddress,
        payerPhone: extractedData.payerPhone,
        memberName: extractedData.memberName || 'Unknown Member',
        memberId: extractedData.memberId || 'Unknown',
        groupNumber: extractedData.groupNumber,
        claimNumber: extractedData.claimNumber || 'Unknown',
        claimDate: extractedData.claimDate,
        processedDate: extractedData.processedDate,
        providerName: extractedData.providerName,
        providerNPI: extractedData.providerNPI,
        serviceStartDate: extractedData.serviceStartDate,
        serviceEndDate: extractedData.serviceEndDate,
        lineItems,
        financialSummary,
        plainLanguageSummary,
        issues,
        notes: []
      };
      
      return eobData;
    } catch (error) {
      console.error('Error extracting EOB data:', error);
      throw new Error('Failed to extract EOB data from document');
    }
  }
  
  private calculateFinancialSummary(lineItems: EOBLineItem[]): EOBFinancialSummary {
    const summary: EOBFinancialSummary = {
      totalBilled: 0,
      totalAllowed: 0,
      totalPlanPaid: 0,
      totalPatientResponsibility: 0,
      totalDeductible: 0,
      totalCopay: 0,
      totalCoinsurance: 0,
      totalNotCovered: 0,
    };
    
    lineItems.forEach(item => {
      summary.totalBilled += item.billedAmount;
      summary.totalAllowed += item.allowedAmount;
      summary.totalPlanPaid += item.planPaid;
      summary.totalPatientResponsibility += item.patientResponsibility;
      summary.totalDeductible += item.deductible || 0;
      summary.totalCopay += item.copay || 0;
      summary.totalCoinsurance += item.coinsurance || 0;
      summary.totalNotCovered += item.notCovered || 0;
    });
    
    return summary;
  }
  
  private generatePlainLanguageSummary(financialSummary: EOBFinancialSummary): string {
    const parts: string[] = [];
    
    parts.push(`You owe $${financialSummary.totalPatientResponsibility.toFixed(2)} because:`);
    
    if (financialSummary.totalDeductible > 0) {
      parts.push(`- $${financialSummary.totalDeductible.toFixed(2)} applied to your deductible`);
    }
    
    if (financialSummary.totalCopay > 0) {
      parts.push(`- $${financialSummary.totalCopay.toFixed(2)} copay`);
    }
    
    if (financialSummary.totalCoinsurance > 0) {
      parts.push(`- $${financialSummary.totalCoinsurance.toFixed(2)} coinsurance (your share after insurance)`);
    }
    
    if (financialSummary.totalNotCovered > 0) {
      parts.push(`- $${financialSummary.totalNotCovered.toFixed(2)} not covered by your plan`);
    }
    
    parts.push(`\nYour insurance paid $${financialSummary.totalPlanPaid.toFixed(2)} on a $${financialSummary.totalAllowed.toFixed(2)} allowed amount (originally billed $${financialSummary.totalBilled.toFixed(2)}).`);
    
    return parts.join('\n');
  }
  
  private detectIssues(lineItems: EOBLineItem[], financialSummary: EOBFinancialSummary, extractedData: any): EOBIssue[] {
    const issues: EOBIssue[] = [];
    
    const serviceDateMap = new Map<string, EOBLineItem[]>();
    lineItems.forEach(item => {
      const key = `${item.serviceDate}-${item.procedureCode}`;
      if (!serviceDateMap.has(key)) {
        serviceDateMap.set(key, []);
      }
      serviceDateMap.get(key)!.push(item);
    });
    
    serviceDateMap.forEach((items, key) => {
      if (items.length > 1) {
        const totalDuplicate = items.reduce((sum, item) => sum + item.patientResponsibility, 0);
        issues.push({
          type: 'duplicate_billing',
          severity: 'high',
          title: 'Possible Duplicate Billing Detected',
          description: `The same service (${items[0].procedureCode}) on ${items[0].serviceDate} appears ${items.length} times. This may be duplicate billing.`,
          affectedLineItems: items.map(i => i.id),
          potentialSavings: totalDuplicate / 2,
          actionRequired: 'Contact your insurance company to verify if this is a duplicate charge.'
        });
      }
    });
    
    const deniedItems = lineItems.filter(item => item.denialCode || item.denialReason);
    if (deniedItems.length > 0) {
      deniedItems.forEach(item => {
        issues.push({
          type: 'denial',
          severity: 'high',
          title: 'Claim Denied or Partially Denied',
          description: `Service on ${item.serviceDate} was denied. Reason: ${item.denialReason || 'Not specified'}`,
          affectedLineItems: [item.id],
          potentialSavings: item.patientResponsibility,
          actionRequired: 'You may be able to appeal this denial. Contact your insurance company for appeal procedures.',
          appealDeadline: 'Typically 180 days from denial date'
        });
      });
    }
    
    const highCostItems = lineItems.filter(item => item.patientResponsibility > 500);
    if (highCostItems.length > 0) {
      highCostItems.forEach(item => {
        issues.push({
          type: 'high_cost',
          severity: 'medium',
          title: 'High Out-of-Pocket Cost',
          description: `Service on ${item.serviceDate} has a patient responsibility of $${item.patientResponsibility.toFixed(2)}.`,
          affectedLineItems: [item.id],
          actionRequired: 'Consider setting up a payment plan with the provider if needed.'
        });
      });
    }
    
    const outOfNetworkItems = lineItems.filter(item => 
      item.notCovered && item.notCovered > 0 && item.notCovered === item.patientResponsibility
    );
    if (outOfNetworkItems.length > 0) {
      issues.push({
        type: 'out_of_network',
        severity: 'high',
        title: 'Possible Out-of-Network Services',
        description: `${outOfNetworkItems.length} service(s) may have been provided by out-of-network providers, resulting in higher costs.`,
        affectedLineItems: outOfNetworkItems.map(i => i.id),
        potentialSavings: outOfNetworkItems.reduce((sum, item) => sum + (item.notCovered || 0), 0) * 0.5,
        actionRequired: 'Verify if these providers were in-network. You may be able to appeal if you were not properly informed.'
      });
    }
    
    return issues;
  }
}
