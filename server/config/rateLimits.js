// All windows are in seconds. Better Auth owns its counters and enforcement.
export const rateLimits = {
	auth: { window: 60, max: 30 },
	setup: { window: 60, max: 10 },
	api: { window: 60, max: 120 },
	integrationAddress: { window: 60, max: 600 },
	mcp: { window: 60, max: 120 },
	public: { window: 60, max: 120 },
	password: { window: 60, max: 10 }
}
