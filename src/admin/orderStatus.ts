import { Inquiry, Order } from '@/types';

export const ORDER_STATUSES: Order['status'][] = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];

export const ORDER_STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Awaiting payment',
  paid: 'Paid – to pack',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export const ORDER_STATUS_HELP: Record<Order['status'], string> = {
  pending: 'The customer started checkout but payment has not been confirmed. Do not make or ship this order yet.',
  paid: 'Payment confirmed. Make and pack the order.',
  packed: 'Packed and waiting for the courier.',
  shipped: 'Handed to the courier. Add the tracking link so the customer can follow it.',
  delivered: 'The customer has received the order.',
  cancelled: 'The order was cancelled.',
  refunded: 'The payment was refunded to the customer.',
};

export const ORDER_STATUS_STYLE: Record<Order['status'], string> = {
  pending: 'border-zinc-600 bg-zinc-800/70 text-zinc-300',
  paid: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
  packed: 'border-purple-700 bg-purple-950/60 text-purple-300',
  shipped: 'border-blue-700 bg-blue-950/60 text-blue-300',
  delivered: 'border-teal-700 bg-teal-950/60 text-teal-300',
  cancelled: 'border-red-800 bg-red-950/60 text-red-300',
  refunded: 'border-amber-800 bg-amber-950/60 text-amber-300',
};

export const INQUIRY_STATUSES: Inquiry['status'][] = ['new', 'contacted', 'booked', 'archived'];

export const INQUIRY_STATUS_LABEL: Record<Inquiry['status'], string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  archived: 'Archived',
};

export const INQUIRY_STATUS_STYLE: Record<Inquiry['status'], string> = {
  new: 'border-amber-700 bg-amber-950/60 text-amber-200',
  contacted: 'border-blue-700 bg-blue-950/60 text-blue-300',
  booked: 'border-emerald-700 bg-emerald-950/60 text-emerald-300',
  archived: 'border-zinc-600 bg-zinc-800/70 text-zinc-300',
};

export const itemCount = (o: Order) => (Array.isArray(o.items) ? o.items.reduce((n, it) => n + (Number(it.quantity) || 0), 0) : 0);
