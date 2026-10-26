ALTER TABLE public.solutions
  ADD COLUMN IF NOT EXISTS t_return_gas_c double precision,
  ADD COLUMN IF NOT EXISTS t_ambient_c double precision;
