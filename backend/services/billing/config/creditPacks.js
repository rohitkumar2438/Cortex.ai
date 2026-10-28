/**
 * Official Credit Packs & Per-Agent Costs for Cortex AI.
 */
export const CREDIT_PACKS = {
    pack_100: {
        id: 'pack_100',
        name: 'Starter Pack',
        credits: 100,
        amountINR: 99,
        popular: false,
        features: ['100 AI credits', 'Full access to Chat & Search', 'Standard response speed']
    },
    pack_500: {
        id: 'pack_500',
        name: 'Pro Pack',
        credits: 500,
        amountINR: 399,
        popular: true,
        features: ['500 AI credits', 'Coding Agent & Live Preview', 'PDF & PPT Export', 'Priority execution']
    },
    pack_1000: {
        id: 'pack_1000',
        name: 'Enterprise Pack',
        credits: 1000,
        amountINR: 699,
        popular: false,
        features: ['1,000 AI credits', 'Best value per credit', 'Unlimited Image Generation', 'Highest priority queue']
    }
};

/**
 * Configurable per-agent credit deduction costs.
 */
export const PER_AGENT_CREDIT_COSTS = {
    chat: 1,
    search: 2,
    coding: 3,
    code: 3,
    pdf: 5,
    ppt: 5,
    image: 5,
    default: 1
};

export const getAgentCreditCost = (agent = 'chat') => {
    return PER_AGENT_CREDIT_COSTS[agent.toLowerCase()] || PER_AGENT_CREDIT_COSTS.default;
};

export default CREDIT_PACKS;
