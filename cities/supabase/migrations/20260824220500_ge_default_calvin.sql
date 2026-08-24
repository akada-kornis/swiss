update public."GemeindeProfil" gp
set software_id = (select id from public."Software" where code = 'calvin')
from public."Gemeinde" g
where g.bfs_id = gp.bfs_id
  and g.canton = 'GE'
  and gp.software_id is null;
