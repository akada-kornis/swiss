insert into public."VP" (code, name) values
  ('prime', 'Prime'), ('data', 'Data'), ('ofisa', 'Ofisa'), ('t2i', 'T2i'),
  ('calvin', 'Calvin'), ('calvin_eadmin', 'Calvin | eAdmin'), ('obt', 'OBT'),
  ('talus', 'Talus'), ('etic_sien', 'Etic@SIEN'), ('ciges', 'Ciges')
on conflict (code) do update set name = excluded.name, active = true;

insert into public."Software" (code, name) values
  ('innosolvcity', 'innosolvcity'), ('urbanus', 'Urbanus')
on conflict (code) do update set name = excluded.name, active = true;
