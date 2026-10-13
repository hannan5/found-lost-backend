import { type Claim, type FoundItem } from "@prisma/client";
import { type MailMessage } from "../../integrations/mailer/mailer.service";

// Plain-text notification emails. Services pick one and hand it to MailerService.
// Never include ownership proof in an email to anyone but the admin.

function signOff(): string {
  return "\n\nWarm regards,\nThe LostNFind team";
}

function contactLines(
  name: string,
  email: string,
  phone: string,
  whatsapp?: string | null,
): string {
  const lines = [`  Name: ${name}`, `  Email: ${email}`, `  Phone: ${phone}`];
  if (whatsapp) lines.push(`  WhatsApp: ${whatsapp}`);
  return lines.join("\n");
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

/** To the owner: approved, plus how to reach the person holding the item. */
export function claimApproved(item: FoundItem, claim: Claim): MailMessage {
  return {
    to: claim.claimantEmail,
    subject: `Good news about "${item.name}"`,
    text:
      `Hi ${claim.claimantName},\n\n` +
      `Your claim for "${item.name}" has been approved. ` +
      `The person who found it is holding it for you. Please get in touch with them to arrange the handover:\n\n` +
      contactLines(
        item.reporterName,
        item.reporterEmail,
        item.reporterPhone,
        item.reporterWhatsapp,
      ) +
      `\n\nIt was found at ${item.location}. ` +
      `Once you have it back, let us know and we'll close the report.` +
      signOff(),
  };
}

/** To the finder: an owner was verified, here is who will contact you. */
export function claimApprovedForReporter(item: FoundItem, claim: Claim): MailMessage {
  return {
    to: item.reporterEmail,
    subject: `The owner of "${item.name}" has been found`,
    text:
      `Hi ${item.reporterName},\n\n` +
      `Thank you for reporting "${item.name}". We've verified its owner, and they will contact you to collect it:\n\n` +
      contactLines(claim.claimantName, claim.claimantEmail, claim.claimantPhone) +
      `\n\nIf you don't hear from them, you're welcome to reach out first.` +
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
