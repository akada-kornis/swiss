# Prime Communes

Observatoire interne du marché communal suisse de Prime Technologies, construit à partir des données publiques Delimo P99 de l’Office fédéral de la statistique et enrichi avec les informations marché Prime.

## Version 1.1

La 1.1 est une **Base Delivery** : elle consolide l’état courant des informations disponibles. Elle n’a pas vocation à historiser les modifications. L’audit fonctionnel commencera avec la 1.5, en même temps que les utilisateurs, rôles et droits nominatifs.

Fonctions livrées :

- 2’110 communes, données OFS / Delimo et districts ;
- Client Prime distinct de l’intégrateur ;
- logiciel métier, ERP et produits/modules séparés ;
- recherche, filtres, tri et export TSV ;
- liens partageables conservant l’onglet et les filtres ;
- carte suisse interactive ;
- statistiques Romandie / cantons / Jura bernois ;
- fiches communales avec données OFS verrouillées et écosystème éditable ;
- interface desktop et Natel ;
- affichage minimal par défaut, ERP + Modules dépliables via **Logiciels**.

Les données live sont lues depuis la vue Supabase `public."GemeindeAktuell"`. Une copie locale reste disponible uniquement comme fallback de lecture.

## Architecture 1.1

Le produit actuellement publié est le dashboard statique `index.html`, complété par :

- `app/globals.css` : socle visuel historique ;
- `app/prime-communes-1.1.js` : comportement 1.1, édition et deep-linking ;
- `app/prime-communes-1.1.5.css` et ses couches importées : stabilisation visuelle 1.1 ;
- `public/` : données de fallback, carte et assets ;
- `supabase/migrations/` : évolution de la base.

Le prototype React/Next présent dans `app/*.tsx` n’est pas la source du dashboard actuellement publié. Il est conservé comme ancien prototype tant que la future migration vers l’infrastructure Prime n’a pas fixé la cible technique définitive.

Voir [`STABILISATION-1.1.md`](./STABILISATION-1.1.md) pour le contrat de non-régression et les règles d’extension.

## Développement

```bash
npm ci
npm run dev
```

Contrôles de non-régression :

```bash
npm run check
```

Construction de production :

```bash
npm run build
```

Une GitHub Action exécute automatiquement le contrôle statique et le build Vite à chaque modification de `cities/`.

## Suite

La 1.5 introduira notamment l’authentification professionnelle, les rôles/RLS, l’audit trail propre, les données commerciales plus sensibles et les futurs objets financiers. Les futurs produits restent extensibles via `Product` + `GemeindeProduct` ; les valeurs financières/LCM devront disposer d’un modèle dédié plutôt que d’être ajoutées comme colonnes improvisées au profil communal.
