import { type Claim, type FoundItem } from "@prisma/client";
import { type MailMessage } from "../../integrations/mailer/mailer.service";

// Plain-text notification emails. Services pick one and hand it to MailerService.
// Never include ownership proof in an email to anyone but the admin.

function signOff(): string {
  return "\n\nWarm regards,\nThe LostNFind team";
}

export function newClaimForAdmin(
  adminEmail: string,
  item: FoundItem,
  claim: Claim,
  adminUrl?: string,
): MailMessage {
  const link = adminUrl ? `\n\nReview it here: ${adminUrl}` : "";
  return {
    to: adminEmail,
    subject: `New claim for "${item.name}"`,
    text:
      `${claim.claimantName} has submitted a claim for "${item.name}" (found at ${item.location}).\n\n` +
      `What they lost: ${claim.lostItemDescription}\n` +
      `Ownership details: ${claim.ownershipProof}\n` +
      `Contact: ${claim.claimantEmail}, ${claim.claimantPhone}` +
      link +
      signOff(),
  };
}

export function claimApproved(item: FoundItem, claim: Claim): MailMessage {
  return {
    to: claim.claimantEmail,
    subject: `Good news about "${item.name}"`,
    text:
      `Hi ${claim.claimantName},\n\n` +
      `Your claim for "${item.name}" has been approved. ` +
      `We'll be in touch at ${claim.claimantPhone} to arrange the handover.` +
      signOff(),
  };
}

export function claimRejected(item: FoundItem, claim: Claim): MailMessage {
  return {
    to: claim.claimantEmail,
    subject: `An update on your claim for "${item.name}"`,
    text:
      `Hi ${claim.claimantName},\n\n` +
      `Thank you for getting in touch about "${item.name}". ` +
      `Unfortunately we weren't able to confirm ownership from the details provided, so this claim wasn't approved. ` +
      `If you have more identifying details, you're welcome to submit a new claim.` +
      signOff(),
  };
}

export function itemReturned(item: FoundItem, claim: Claim): MailMessage {
  return {
    to: claim.claimantEmail,
    subject: `"${item.name}" is back with you`,
    text:
      `Hi ${claim.claimantName},\n\n` +
      `We've marked "${item.name}" as returned. We're glad it found its way home.` +
      signOff(),
  };
}
