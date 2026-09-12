export interface OtpSender {
	sendOtp(phone: string, code: string): Promise<void>;
}

export interface SentOtp {
	phone: string;
	code: string;
	sentAt: Date;
}

export class MockOtpSender implements OtpSender {
	readonly sent: SentOtp[] = [];

	async sendOtp(phone: string, code: string): Promise<void> {
		this.sent.push({ phone, code, sentAt: new Date() });
	}
}

export class TermiiOtpSender implements OtpSender {
	constructor(
		private readonly apiKey: string,
		private readonly senderId: string,
		private readonly baseUrl = 'https://api.ng.termii.com/api/sms/send',
	) {}

	async sendOtp(phone: string, code: string): Promise<void> {
		await fetch(this.baseUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				to: phone,
				from: this.senderId,
				sms: `Your Together verification code is ${code}`,
				type: 'plain',
				channel: 'generic',
				api_key: this.apiKey,
			}),
		});
	}
}

export function createOtpSender(provider: string): OtpSender {
	if (provider === 'termii') {
		return new TermiiOtpSender(
			process.env.TERMII_API_KEY ?? '',
			process.env.TERMII_SENDER_ID ?? '',
		);
	}
	return new MockOtpSender();
}
