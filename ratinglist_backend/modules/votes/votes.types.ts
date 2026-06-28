export interface VoteServerParams {
    serverId: string;
}

export interface VoteListQuery {
    page?: number;
    limit?: number;
}

export interface VoteSummary {
    totalVotes: number;
    uniqueVoters: number;
    latestVoteAt: string | null;
}

export interface VoteUserState {
    hasSession: boolean;
    canVote: boolean;
    lastVoteAt: string | null;
    nextVoteAt: string | null;
    cooldownSecondsLeft: number;
}

export interface VoteRecordItem {
    id: string;
    userId: string;
    userName: string;
    userAvatarUrl: string | null;
    votes: number;
    lastVoteAt: string;
}

export interface VoteServerResponse {
    server: {
        id: string;
        slug: string;
        name: string;
        rating: number;
    };
    summary: VoteSummary;
    userState: VoteUserState;
    items: VoteRecordItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
