import { createAuthClient } from 'better-auth/vue'
import { passkeyClient } from '@better-auth/passkey/client'
export default defineNuxtPlugin(() => ({
	provide: { auth: createAuthClient({ plugins: [passkeyClient()] }) }
}))
