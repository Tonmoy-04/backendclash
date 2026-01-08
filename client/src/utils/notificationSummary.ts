/**
 * Utility functions for creating dynamic notification summaries
 * 
 * These functions help build detailed, context-aware notification messages
 * that show exactly what action was performed and on which entity.
 */

export interface NotificationSummaryOptions {
  entityName?: string;
  actionType: string;
  amount?: number;
  description?: string;
  quantity?: number;
  productName?: string;
  customerName?: string;
  supplierName?: string;
  transactionType?: string;
  formatAmount?: (amount: number) => string;
}

/**
 * Build a dynamic summary message for notifications
 * 
 * @param options - Configuration for the summary
 * @returns Formatted summary string with relevant details
 */
export function buildNotificationSummary(options: NotificationSummaryOptions): string {
  const {
    entityName,
    actionType,
    amount,
    description,
    quantity,
    productName,
    customerName,
    supplierName,
    transactionType,
    formatAmount
  } = options;

  const lines: string[] = [];

  // Add entity/product/customer/supplier name with icons
  if (productName) {
    lines.push(`📦 <strong>Product:</strong> ${productName}`);
  } else if (customerName) {
    lines.push(`👤 <strong>Customer:</strong> ${customerName}`);
  } else if (supplierName) {
    lines.push(`🏢 <strong>Supplier:</strong> ${supplierName}`);
  } else if (entityName) {
    lines.push(`📌 <strong>Name:</strong> ${entityName}`);
  }

  // Add action type with icon
  if (actionType) {
    const actionIcon = getActionIcon(actionType);
    lines.push(`${actionIcon} <strong>Action:</strong> ${actionType}`);
  }

  // Add transaction type if available (Sale/Purchase)
  if (transactionType) {
    const typeIcon = transactionType === 'Sale' ? '💰' : '🛒';
    lines.push(`${typeIcon} <strong>Type:</strong> ${transactionType}`);
  }

  // Add quantity if available
  if (quantity !== undefined && quantity !== null) {
    lines.push(`📊 <strong>Quantity:</strong> ${quantity}`);
  }

  // Add amount if available with prominent styling
  if (amount !== undefined && amount !== null) {
    const formattedAmount = formatAmount ? formatAmount(amount) : `৳${amount.toLocaleString()}`;
    lines.push(`💵 <strong>Amount:</strong> <span style="color: #059669; font-weight: 700;">${formattedAmount}</span>`);
  }

  // Add description only if provided
  if (description && description.trim()) {
    lines.push(`📝 <strong>Note:</strong> <em>${description.trim()}</em>`);
  }

  return lines.join('<br/>');
}

/**
 * Get appropriate icon for action type
 */
function getActionIcon(actionType: string): string {
  const lowerAction = actionType.toLowerCase();
  
  if (lowerAction.includes('payment') || lowerAction.includes('deposit')) return '✅';
  if (lowerAction.includes('charge') || lowerAction.includes('added')) return '➕';
  if (lowerAction.includes('withdraw')) return '💸';
  if (lowerAction.includes('purchase') || lowerAction.includes('buy')) return '🛒';
  if (lowerAction.includes('sale') || lowerAction.includes('sold')) return '💰';
  if (lowerAction.includes('update')) return '🔄';
  if (lowerAction.includes('record')) return '📝';
  
  return '✨';
}

/**
 * Build a summary for inventory add/update operations
 */
export function buildInventorySummary(
  productName: string,
  action: 'Add' | 'Update',
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    productName,
    actionType: action === 'Add' ? 'Added to Inventory' : 'Updated',
    formatAmount
  });
}

/**
 * Build a summary for stock purchase/sale operations
 */
export function buildStockMovementSummary(
  productName: string,
  action: 'Purchase' | 'Sale',
  quantity: number,
  amount?: number,
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    productName,
    actionType: action === 'Purchase' ? 'Stock Purchased' : 'Stock Sold',
    quantity,
    amount,
    formatAmount
  });
}

/**
 * Build a summary for customer balance operations (deposit/charge)
 */
export function buildCustomerBalanceSummary(
  customerName: string,
  action: 'Payment' | 'Charge',
  amount: number,
  description?: string,
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    customerName,
    actionType: action === 'Payment' ? 'Payment Received' : 'Charge Added',
    amount,
    description,
    formatAmount
  });
}

/**
 * Build a summary for supplier balance operations (deposit/charge)
 */
export function buildSupplierBalanceSummary(
  supplierName: string,
  action: 'Deposit' | 'Charge',
  amount: number,
  description?: string,
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    supplierName,
    actionType: action === 'Deposit' ? 'Deposit Made' : 'Charge Added',
    amount,
    description,
    formatAmount
  });
}

/**
 * Build a summary for transaction operations (sale/purchase)
 */
export function buildTransactionSummary(
  type: 'Sale' | 'Purchase',
  customerOrSupplier: string,
  totalAmount: number,
  description?: string,
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    [type === 'Sale' ? 'customerName' : 'supplierName']: customerOrSupplier,
    transactionType: type,
    actionType: type === 'Sale' ? 'Sale Recorded' : 'Purchase Recorded',
    amount: totalAmount,
    description,
    formatAmount
  });
}

/**
 * Build a summary for cashbox operations (deposit/withdrawal)
 */
export function buildCashboxSummary(
  action: 'Deposit' | 'Withdraw',
  amount: number,
  description?: string,
  formatAmount?: (amount: number) => string
): string {
  return buildNotificationSummary({
    actionType: action === 'Deposit' ? 'Deposit to Cashbox' : 'Withdrawal from Cashbox',
    amount,
    description,
    formatAmount
  });
}
