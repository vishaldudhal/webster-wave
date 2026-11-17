export const STORAGE_KEY = "growth30.planner.v1";
export const DISMISS_KEY = "growth30.reminder.dismissed.";
export const DEFAULT_OWNER = "Vishal";
export const PRIORITIES = ["High", "Medium", "Low"];
export const STATUSES = ["Scheduled", "In progress", "Completed"];
export const MAX_DAILY_OPEN = 6;

export const VERTICAL_TEMPLATES = {
  "Local Business Development": ["Shortlist the business", "Complete research", "Establish contact", "Complete visit or meeting", "Send follow-up", "Record next step"],
  "Existing Network": ["Select the contact", "Review context", "Prepare a relevant message", "Send message", "Complete follow-up", "Record outcome"],
  "Past Client Development": ["Review past work", "Identify a relevant opportunity", "Prepare the approach", "Send message", "Complete follow-up", "Record outcome"],
  "Direct Outreach": ["Research the business", "Identify the right contact", "Personalise the message", "Send outreach", "Schedule follow-up", "Record outcome"],
  Inbound: ["Review enquiry", "Send initial response", "Document requirements", "Qualify opportunity", "Set next action"],
  Partnerships: ["Research partner fit", "Define mutual value", "Prepare proposal", "Start conversation", "Agree next steps", "Record outcome"],
  Marketing: ["Define objective and audience", "Draft content", "Prepare creative", "Review and approve", "Publish", "Record results"],
  "Events & Networking": ["Select event", "Register", "Set networking goals", "Prepare talking points", "Attend", "Follow up with contacts"],
};

export const DEFAULT_VERTICALS = Object.keys(VERTICAL_TEMPLATES);
export const PLATFORM_SUGGESTIONS = ["LinkedIn", "Instagram", "Facebook", "Email", "Phone", "WhatsApp", "Website", "Blog", "Quora", "YouTube", "Pinterest", "In person"];
export const ACTIVITY_TYPE_SUGGESTIONS = ["Post", "Article", "Reel / Short", "Q&A", "Email", "Call", "Meeting", "Visit", "Follow-up", "Research", "Proposal", "Event"];
export const CATEGORY_SUGGESTIONS = ["Awareness", "Engagement", "Lead generation", "Relationship", "Conversion", "Retention", "Partnership", "Networking"];
