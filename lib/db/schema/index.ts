export { accounts } from "./accounts";
export { organizationInvitations } from "./organization-invitations";
export { organizationMembers } from "./organization-members";
export { organizations } from "./organizations";
export { sessions } from "./sessions";
export { users } from "./users";
export { verifications } from "./verifications";

import { accounts } from "./accounts";
import { organizationInvitations } from "./organization-invitations";
import { organizationMembers } from "./organization-members";
import { organizations } from "./organizations";
import { sessions } from "./sessions";
import { users } from "./users";
import { verifications } from "./verifications";

export const schema = {
	users,
	sessions,
	accounts,
	verifications,
	organizations,
	organizationMembers,
	organizationInvitations,
};
