import { useCallback, useEffect, useRef, useState } from 'react';

interface VoteUpdate {
	voteCount: number;
	hasVoted: boolean;
}

export function useVoteWebSocket(requestId: string | null) {
	const [voteData, setVoteData] = useState<VoteUpdate | null>(null);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const connect = useCallback(() => {
		if (!requestId) return;

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const host = window.location.host;
		const wsUrl = `${protocol}//${host}/api/ws/votes/${requestId}`;

		try {
			const ws = new WebSocket(wsUrl);
			wsRef.current = ws;

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data) as VoteUpdate;
					setVoteData(data);
				} catch {
					// Ignore malformed messages
				}
			};

			ws.onclose = () => {
				wsRef.current = null;
				reconnectTimeoutRef.current = setTimeout(connect, 3000);
			};

			ws.onerror = () => {
				ws.close();
			};
		} catch {
			reconnectTimeoutRef.current = setTimeout(connect, 3000);
		}
	}, [requestId]);

	useEffect(() => {
		connect();
		return () => {
			if (wsRef.current) {
				wsRef.current.close();
				wsRef.current = null;
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
		};
	}, [connect]);

	return voteData;
}
