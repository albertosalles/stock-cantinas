-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.cantina_access (
                                       cantina_id uuid NOT NULL,
                                       pin_code text NOT NULL,
                                       is_active boolean NOT NULL DEFAULT true,
                                       created_at timestamp with time zone NOT NULL DEFAULT now(),
                                       updated_at timestamp with time zone NOT NULL DEFAULT now(),
                                       CONSTRAINT cantina_access_pkey PRIMARY KEY (cantina_id),
                                       CONSTRAINT cantina_access_v2_cantina_id_fkey FOREIGN KEY (cantina_id) REFERENCES public.cantinas(id)
);
CREATE TABLE public.cantinas (
                                 id uuid NOT NULL DEFAULT gen_random_uuid(),
                                 name text NOT NULL,
                                 location text,
                                 CONSTRAINT cantinas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_cantinas (
                                       id uuid NOT NULL DEFAULT gen_random_uuid(),
                                       event_id uuid,
                                       cantina_id uuid,
                                       CONSTRAINT event_cantinas_pkey PRIMARY KEY (id),
                                       CONSTRAINT event_cantinas_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
                                       CONSTRAINT event_cantinas_cantina_id_fkey FOREIGN KEY (cantina_id) REFERENCES public.cantinas(id)
);
CREATE TABLE public.event_products (
                                       id uuid NOT NULL DEFAULT gen_random_uuid(),
                                       event_id uuid,
                                       product_id uuid,
                                       price_cents integer NOT NULL,
                                       active boolean DEFAULT true,
                                       low_stock_threshold integer DEFAULT 0,
                                       CONSTRAINT event_products_pkey PRIMARY KEY (id),
                                       CONSTRAINT event_products_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
                                       CONSTRAINT event_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.events (
                               id uuid NOT NULL DEFAULT gen_random_uuid(),
                               name text NOT NULL,
                               date timestamp with time zone NOT NULL,
                               status text DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'live'::text, 'closed'::text])),
                               CONSTRAINT events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.inventory_snapshots (
                                            id uuid NOT NULL DEFAULT gen_random_uuid(),
                                            event_id uuid,
                                            cantina_id uuid,
                                            product_id uuid,
                                            kind text CHECK (kind = ANY (ARRAY['INITIAL'::text, 'FINAL'::text])),
                                            qty integer NOT NULL CHECK (qty >= 0),
                                            created_by uuid,
                                            created_at timestamp with time zone DEFAULT now(),
                                            CONSTRAINT inventory_snapshots_pkey PRIMARY KEY (id),
                                            CONSTRAINT inventory_snapshots_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
                                            CONSTRAINT inventory_snapshots_cantina_id_fkey FOREIGN KEY (cantina_id) REFERENCES public.cantinas(id),
                                            CONSTRAINT inventory_snapshots_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
                                            CONSTRAINT inventory_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.products (
                                 id uuid NOT NULL DEFAULT gen_random_uuid(),
                                 sku text UNIQUE,
                                 name text NOT NULL,
                                 unit text DEFAULT 'ud'::text,
                                 CONSTRAINT products_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sale_line_items (
                                        id uuid NOT NULL DEFAULT gen_random_uuid(),
                                        sale_id uuid,
                                        product_id uuid,
                                        qty integer NOT NULL CHECK (qty > 0),
                                        unit_price_cents integer NOT NULL,
                                        CONSTRAINT sale_line_items_pkey PRIMARY KEY (id),
                                        CONSTRAINT sale_line_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
                                        CONSTRAINT sale_line_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.sales (
                              id uuid NOT NULL DEFAULT gen_random_uuid(),
                              event_id uuid,
                              cantina_id uuid,
                              user_id uuid,
                              total_cents integer NOT NULL,
                              total_items integer NOT NULL,
                              status text DEFAULT 'OK'::text CHECK (status = ANY (ARRAY['OK'::text, 'CANCELED'::text])),
                              created_at timestamp with time zone DEFAULT now(),
                              CONSTRAINT sales_pkey PRIMARY KEY (id),
                              CONSTRAINT sales_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
                              CONSTRAINT sales_cantina_id_fkey FOREIGN KEY (cantina_id) REFERENCES public.cantinas(id),
                              CONSTRAINT sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.stock_movements (
                                        id uuid NOT NULL DEFAULT gen_random_uuid(),
                                        event_id uuid,
                                        cantina_id uuid,
                                        product_id uuid,
                                        qty integer NOT NULL,
                                        type text CHECK (type = ANY (ARRAY['INIT'::text, 'SALE'::text, 'ADJUSTMENT'::text, 'TRANSFER_IN'::text, 'TRANSFER_OUT'::text, 'WASTE'::text, 'RETURN'::text])),
                                        reason text,
                                        ref_sale_id uuid,
                                        created_by uuid,
                                        created_at timestamp with time zone DEFAULT now(),
                                        CONSTRAINT stock_movements_pkey PRIMARY KEY (id),
                                        CONSTRAINT stock_movements_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
                                        CONSTRAINT stock_movements_cantina_id_fkey FOREIGN KEY (cantina_id) REFERENCES public.cantinas(id),
                                        CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
                                        CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.users (
                              id uuid NOT NULL DEFAULT gen_random_uuid(),
                              email text NOT NULL UNIQUE,
                              name text,
                              created_at timestamp with time zone DEFAULT now(),
                              CONSTRAINT users_pkey PRIMARY KEY (id)
);