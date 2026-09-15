import { Elysia } from 'elysia';
import { subscribeToVoteUpdates } from '../modules/requests/vote';

export function createVoteWsRouter() {
	return new Elysia().ws('/ws/votes/:requestId', {
		open(ws) {
			const requestId = ws.data.params.requestId;
			if (typeof requestId !== 'string') return;

			const unsubscribe = subscribeToVoteUpdates(requestId, (data) => {
				ws.send(JSON.stringify(data));
			});

			(ws as unknown as { data: { unsubscribe?: () => void } }).data.unsubscribe = unsubscribe;
		},
		close(ws) {
			const unsub = (ws as unknown as { data: { unsubscribe?: () => void } }).data.unsubscribe;
			if (unsub) unsub();
		},
		message() {
			// Client messages are ignored; this is a push-only channel
		},
	});
}
