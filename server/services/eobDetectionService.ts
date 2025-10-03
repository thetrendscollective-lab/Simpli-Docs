export class EOBDetectionService {
  detectEOB(text: string): { isEOB: boolean; confidence: number; reason: string } {
    const lowerText = text.toLowerCase();
    
    const strongIndicators = [
      'explanation of benefits',
      'eob',
      'patient responsibility',
      'claim number',
      'billed amount',
      'allowed amount',
      'plan paid',
      'member id',
      'subscriber id',
      'deductible',
      'coinsurance',
      'copay',
      'out-of-pocket'
    ];
    
    const medicalBillingTerms = [
      'cpt',
      'hcpcs',
      'icd-10',
      'icd-9',
      'diagnosis code',
      'procedure code',
      'service date',
      'date of service',
      'provider name',
      'provider npi',
      'health plan',
      'insurance carrier',
      'medical claim'
    ];
    
    const financialTerms = [
      'total charges',
      'total billed',
      'amount you owe',
      'patient owes',
      'amount paid',
      'payment amount',
      'adjustment',
      'discount',
      'not covered',
      'denied'
    ];
    
    let score = 0;
    let matchedIndicators: string[] = [];
    
    strongIndicators.forEach(indicator => {
      if (lowerText.includes(indicator)) {
        score += 3;
        matchedIndicators.push(indicator);
      }
    });
    
    medicalBillingTerms.forEach(term => {
      if (lowerText.includes(term)) {
        score += 2;
        matchedIndicators.push(term);
      }
    });
    
    financialTerms.forEach(term => {
      if (lowerText.includes(term)) {
        score += 1;
        matchedIndicators.push(term);
      }
    });
    
    const hasMonetaryAmounts = /\$\s*\d+[\d,]*\.?\d{0,2}/.test(text);
    if (hasMonetaryAmounts) {
      score += 2;
    }
    
    const hasDates = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/.test(text);
    if (hasDates) {
      score += 1;
    }
    
    const confidence = Math.min(100, (score / 20) * 100);
    const isEOB = confidence >= 50;
    
    const reason = isEOB 
      ? `Document contains ${matchedIndicators.length} EOB-related terms: ${matchedIndicators.slice(0, 5).join(', ')}${matchedIndicators.length > 5 ? '...' : ''}`
      : `Document does not contain sufficient EOB indicators (confidence: ${confidence.toFixed(0)}%)`;
    
    return {
      isEOB,
      confidence: Math.round(confidence),
      reason
    };
  }
}
