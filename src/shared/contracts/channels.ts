export const PRODUCT_IPC_CHANNELS = [
  'library:create',
  'library:open',
  'library:get-current',
  'books:list',
  'books:import-source',
  'structure:get',
  'structure:detect',
  'structure:update-node',
  'structure:update-story-range',
  'structure:freeze',
  'modules:list-instances',
  'modules:update-body',
  'jobs:list',
  'jobs:get',
  'jobs:cancel',
  'exports:get-status',
] as const;

export type ProductIpcChannel = (typeof PRODUCT_IPC_CHANNELS)[number];

export function isProductIpcChannel(channel: string): channel is ProductIpcChannel {
  return PRODUCT_IPC_CHANNELS.includes(channel as ProductIpcChannel);
}
