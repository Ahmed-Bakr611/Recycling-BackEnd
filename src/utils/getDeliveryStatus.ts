export const getDeliveryUserStatus = (user: any): "pending" | "approved" | "declined" | "revoked" => {
  const declineReason = user.attachments?.declineReason || null;
  const declinedAt = user.attachments?.declinedAt || null;
  const approvedAt = user.attachments?.approvedAt || null;
  const revokeReason = user.attachments?.revokeReason || null;
  const revokedAt = user.attachments?.revokedAt || null;

  // Get timestamps for comparison
  const declineTimestamp = declinedAt ? new Date(declinedAt).getTime() : 0;
  const approveTimestamp = approvedAt ? new Date(approvedAt).getTime() : 0;
  const revokeTimestamp = revokedAt ? new Date(revokedAt).getTime() : 0;

  // Find most recent action
  const mostRecentTimestamp = Math.max(declineTimestamp, approveTimestamp, revokeTimestamp);

  if (mostRecentTimestamp === revokeTimestamp && revokeReason) {
    return "revoked";
  } else if (mostRecentTimestamp === declineTimestamp && declineReason) {
    return "declined";
  } else if (mostRecentTimestamp === approveTimestamp && user.isApproved) {
    return "approved";
  } else {
    return "pending";
  }
};