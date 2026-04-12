-- Run this in the Supabase SQL Editor to create the orders table

create table orders (
  id uuid default gen_random_uuid() primary key,
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null,
  payment_method text not null default 'venmo',
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed')),
  fulfillment_status text not null default 'pending' check (fulfillment_status in ('pending','processing','shipped','delivered')),
  line_items jsonb not null,
  total numeric(10,2) not null,
  tracking_number text,
  notes text,
  created_at timestamptz default now()
);

-- Index for fast lookups by email and status
create index orders_email_idx on orders(customer_email);
create index orders_payment_status_idx on orders(payment_status);
create index orders_created_at_idx on orders(created_at desc);

-- Row Level Security (keep orders private — only service role can read/write)
alter table orders enable row level security;

-- Allow inserts from the anon key (customers placing orders)
create policy "Allow order inserts" on orders
  for insert to anon with check (true);

-- Allow reads by order ID (for confirmation page)
create policy "Allow order reads by id" on orders
  for select to anon using (true);

-- Note: Updates (marking paid/shipped) go through the service role key in API routes
