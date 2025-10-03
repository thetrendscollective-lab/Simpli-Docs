import { EOBData, EOBLineItem, EOBIssue } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/button';
import { AlertTriangle, CheckCircle, Download, FileText, AlertCircle } from 'lucide-react';

interface EOBAnalyzerProps {
  eobData: EOBData;
  documentId?: string;
}

export function EOBAnalyzer({ eobData, documentId }: EOBAnalyzerProps) {
  const handleExportCSV = async () => {
    if (!documentId) return;
    window.location.href = `/api/eob/${documentId}/export-csv`;
  };

  const handleGenerateAppeal = async () => {
    if (!documentId) return;
    window.location.href = `/api/eob/${documentId}/generate-appeal`;
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'medium':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'low':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'medium':
        return <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case 'low':
        return <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const totalBilled = eobData.financialSummary.totalBilled;
  const totalAllowed = eobData.financialSummary.totalAllowed;
  const totalPlanPaid = eobData.financialSummary.totalPlanPaid;
  const totalYouOwe = eobData.financialSummary.totalPatientResponsibility;

  const planPaidPercent = totalAllowed > 0 ? (totalPlanPaid / totalAllowed) * 100 : 0;
  const youOwePercent = totalAllowed > 0 ? (totalYouOwe / totalAllowed) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header Information */}
      <Card data-testid="card-eob-header">
        <CardHeader>
          <CardTitle>Insurance Bill Summary (EOB)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Insurance Company</p>
              <p className="font-medium" data-testid="text-payer-name">{eobData.payerName}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Member Name</p>
              <p className="font-medium" data-testid="text-member-name">{eobData.memberName}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Member ID</p>
              <p className="font-medium" data-testid="text-member-id">{eobData.memberId}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Claim Number</p>
              <p className="font-medium" data-testid="text-claim-number">{eobData.claimNumber}</p>
            </div>
            {eobData.serviceStartDate && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">Service Date</p>
                <p className="font-medium" data-testid="text-service-date">
                  {eobData.serviceStartDate}
                  {eobData.serviceEndDate && eobData.serviceEndDate !== eobData.serviceStartDate && ` to ${eobData.serviceEndDate}`}
                </p>
              </div>
            )}
            {eobData.providerName && (
              <div>
                <p className="text-slate-500 dark:text-slate-400">Provider</p>
                <p className="font-medium" data-testid="text-provider-name">{eobData.providerName}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plain Language Summary */}
      <Card data-testid="card-plain-language-summary">
        <CardHeader>
          <CardTitle>What This Means for You</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-slate-700 dark:text-slate-300" data-testid="text-plain-summary">
            {eobData.plainLanguageSummary}
          </p>
        </CardContent>
      </Card>

      {/* Visual Cost Breakdown */}
      <Card data-testid="card-cost-breakdown">
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Originally Billed</p>
              <p className="text-2xl font-bold" data-testid="text-total-billed">${totalBilled.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Allowed Amount</p>
              <p className="text-2xl font-bold" data-testid="text-total-allowed">${totalAllowed.toFixed(2)}</p>
            </div>
          </div>

          {/* Visual Bar Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-600 dark:text-slate-400">Insurance Paid</span>
              <span className="font-semibold text-green-600 dark:text-green-400" data-testid="text-plan-paid">
                ${totalPlanPaid.toFixed(2)} ({planPaidPercent.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-8 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex">
              <div
                className="bg-green-500 dark:bg-green-600 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${planPaidPercent}%` }}
                data-testid="bar-plan-paid"
              >
                {planPaidPercent > 15 && 'Insurance'}
              </div>
              <div
                className="bg-red-500 dark:bg-red-600 flex items-center justify-center text-white text-xs font-medium"
                style={{ width: `${youOwePercent}%` }}
                data-testid="bar-you-owe"
              >
                {youOwePercent > 15 && 'You Owe'}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">You Owe</span>
              <span className="font-semibold text-red-600 dark:text-red-400" data-testid="text-you-owe">
                ${totalYouOwe.toFixed(2)} ({youOwePercent.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Breakdown of What You Owe */}
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <p className="font-medium mb-2 text-slate-700 dark:text-slate-300">Your Responsibility Breakdown:</p>
            <div className="space-y-1 text-sm">
              {eobData.financialSummary.totalDeductible > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Deductible</span>
                  <span className="font-medium" data-testid="text-total-deductible">${eobData.financialSummary.totalDeductible.toFixed(2)}</span>
                </div>
              )}
              {eobData.financialSummary.totalCopay > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Copay</span>
                  <span className="font-medium" data-testid="text-total-copay">${eobData.financialSummary.totalCopay.toFixed(2)}</span>
                </div>
              )}
              {eobData.financialSummary.totalCoinsurance > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Coinsurance</span>
                  <span className="font-medium" data-testid="text-total-coinsurance">${eobData.financialSummary.totalCoinsurance.toFixed(2)}</span>
                </div>
              )}
              {eobData.financialSummary.totalNotCovered > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Not Covered</span>
                  <span className="font-medium" data-testid="text-total-not-covered">${eobData.financialSummary.totalNotCovered.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues & Alerts */}
      {eobData.issues.length > 0 && (
        <Card data-testid="card-issues">
          <CardHeader>
            <CardTitle>Important Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {eobData.issues.map((issue, idx) => (
              <Alert
                key={idx}
                className={getSeverityColor(issue.severity)}
                data-testid={`alert-issue-${idx}`}
              >
                <div className="flex gap-3">
                  {getSeverityIcon(issue.severity)}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1" data-testid={`text-issue-title-${idx}`}>{issue.title}</h4>
                    <AlertDescription className="text-sm" data-testid={`text-issue-description-${idx}`}>
                      {issue.description}
                    </AlertDescription>
                    {issue.potentialSavings && (
                      <p className="text-sm font-medium mt-2 text-green-700 dark:text-green-400" data-testid={`text-potential-savings-${idx}`}>
                        Potential savings: ${issue.potentialSavings.toFixed(2)}
                      </p>
                    )}
                    {issue.actionRequired && (
                      <p className="text-sm font-medium mt-2" data-testid={`text-action-required-${idx}`}>
                        Action: {issue.actionRequired}
                      </p>
                    )}
                    {issue.appealDeadline && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1" data-testid={`text-appeal-deadline-${idx}`}>
                        Appeal deadline: {issue.appealDeadline}
                      </p>
                    )}
                  </div>
                </div>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <Card data-testid="card-line-items">
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Date</th>
                  <th className="text-left p-2 font-medium text-slate-600 dark:text-slate-400">Service</th>
                  <th className="text-right p-2 font-medium text-slate-600 dark:text-slate-400">Billed</th>
                  <th className="text-right p-2 font-medium text-slate-600 dark:text-slate-400">Allowed</th>
                  <th className="text-right p-2 font-medium text-slate-600 dark:text-slate-400">Insurance Paid</th>
                  <th className="text-right p-2 font-medium text-slate-600 dark:text-slate-400">You Owe</th>
                </tr>
              </thead>
              <tbody>
                {eobData.lineItems.map((item, idx) => (
                  <tr key={item.id} className="border-b dark:border-slate-800" data-testid={`row-line-item-${idx}`}>
                    <td className="p-2" data-testid={`text-service-date-${idx}`}>{item.serviceDate}</td>
                    <td className="p-2">
                      <div>
                        <p className="font-medium" data-testid={`text-procedure-description-${idx}`}>{item.procedureDescription}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400" data-testid={`text-procedure-code-${idx}`}>
                          {item.procedureCode}
                          {item.diagnosisCode && ` • ${item.diagnosisCode}`}
                        </p>
                        {item.denialReason && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1" data-testid={`text-denial-reason-${idx}`}>
                            Denied: {item.denialReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="text-right p-2" data-testid={`text-billed-${idx}`}>${item.billedAmount.toFixed(2)}</td>
                    <td className="text-right p-2" data-testid={`text-allowed-${idx}`}>${item.allowedAmount.toFixed(2)}</td>
                    <td className="text-right p-2 text-green-600 dark:text-green-400" data-testid={`text-plan-paid-${idx}`}>
                      ${item.planPaid.toFixed(2)}
                    </td>
                    <td className="text-right p-2 font-medium" data-testid={`text-patient-resp-${idx}`}>
                      ${item.patientResponsibility.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Export Actions */}
      <Card data-testid="card-export-actions">
        <CardHeader>
          <CardTitle>Export & Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3 flex-wrap">
          <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" />
            Export as CSV
          </Button>
          {eobData.issues.some(issue => issue.type === 'denial' || issue.type === 'duplicate_billing' || issue.type === 'out_of_network') && (
            <Button onClick={handleGenerateAppeal} variant="outline" data-testid="button-generate-appeal">
              <FileText className="h-4 w-4 mr-2" />
              Generate Appeal Letter
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
