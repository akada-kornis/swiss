# Prime Communes · Stabilisation 1.1

## But

Cette étape ne crée aucune nouvelle fonction métier. Elle stabilise la version 1.1 livrée afin de préparer la 1.5 et une éventuelle migration vers l’infrastructure Prime sans changer le comportement visible du site.

Le point de retour GitHub avant refactoring est la branche :

`snapshot/prime-communes-1.1-final`

## Contrat fonctionnel gelé

La stabilisation doit conserver :

- les quatre onglets Communes / Carte / Stats / Roadmap ;
- les filtres, le tri, l’export et les liens partageables ;
- la vue minimale par défaut avec ERP + Modules repliés ;
- le bouton Logiciels pour afficher ERP + Modules ;
- les fiches communales et l’édition des données non-OFS ;
- les règles Client Prime, Intégrateur, Métier, ERP et Modules ;
- la carte, les statistiques et le comportement Natel ;
- le rendu actuel des logos et marques.

## Modèle de données 1.1

Prime Communes 1.1 est une **Base Delivery** : elle consolide l’état courant des informations disponibles. Elle ne cherche pas à historiser la vie des données.

- `Gemeinde` : identité communale et référentiel OFS.
- `GemeindeProfil` : état commercial courant de la commune.
- `VP` : intégrateurs.
- `Software` : logiciel métier.
- `ERP` : ERP, distinct du métier.
- `Product` : catalogue extensible des produits/modules additionnels.
- `GemeindeProduct` : relation plusieurs-produits-par-commune.
- `GemeindeAktuell` : vue de lecture utilisée par le site.

`GemeindeProfilAudit` reste uniquement comme structure dormante pour ne pas casser les anciennes migrations. **Elle est vide en 1.1 et son trigger est désactivé.** Aucun historique fonctionnel n’est conservé avant la 1.5. L’audit sera redéfini avec les utilisateurs, rôles et droits nominatifs en 1.5.

## Règles d’extension

### Produits supplémentaires

Un nouveau produit ou module ne doit pas devenir une nouvelle colonne dans `GemeindeProfil`. Il doit entrer dans `Product` puis être lié aux communes par `GemeindeProduct`. Ce modèle permet d’ajouter demain d’autres produits sans modifier la structure centrale.

### Métier et ERP

Un logiciel métier n’est pas un module et un ERP n’est pas un module par défaut. Les trois notions doivent rester séparées même lorsqu’un même nom commercial peut jouer plusieurs rôles dans des cas particuliers.

### Données financières et LCM

Les valeurs financières, contrats, LCM, prix, marges, récurrence ou autres notions commerciales futures ne doivent pas être ajoutés comme une série de colonnes improvisées dans `GemeindeProfil` ou `Product`.

Elles devront être modélisées dans une structure dédiée en 1.5, une fois leurs règles fonctionnelles précisées. Cela permettra notamment plusieurs produits, plusieurs valeurs ou contrats par commune, des droits d’accès spécifiques et, à partir de la 1.5, un historique propre.

## Sécurité 1.1

- lecture publique limitée à la vue `GemeindeAktuell` et au seul privilège `SELECT` ;
- édition 1.1 via `save_commune_profile_v11()` ;
- pas d’écriture directe `authenticated` sur `GemeindeProfil` ou `GemeindeProduct` ;
- privilèges `TRUNCATE`, `TRIGGER` et `REFERENCES` retirés à `anon` et `authenticated` sur les tables métier ;
- fonctions techniques et audit non exposés publiquement ;
- SSO + rôles + RLS métier reportés à la 1.5.

## Outillage stabilisé

- `vite.config.ts` construit désormais directement le dashboard statique 1.1 ;
- les dépendances au vieux scaffold OpenAI/Cloudflare ne participent plus au build publié ;
- `npm run check` vérifie la syntaxe JS et le contrat de non-régression ;
- une GitHub Action lance automatiquement les tests et un build Vite de production ;
- GitHub Pages continue de déployer le `main` comme auparavant.

## Checklist de non-régression

1. Ouverture `/cities/` : vue Communes, filtres neutres, ERP + Modules masqués.
2. `Réinitialiser` : retour au même état minimal.
3. `Logiciels` : affiche puis masque ERP + Modules.
4. Deep-link : onglet et filtres sont restaurés depuis l’URL.
5. Retour / Suivant navigateur : restauration de l’état.
6. Client Prime / eAdmin / Districts / Logiciels : rendu desktop et Natel inchangé.
7. Fiche commune : OFS en lecture seule, écosystème éditable.
8. Sauvegarde fiche : rechargement des données live après succès.
9. Carte : recherche, zoom, ouverture d’une commune.
10. Stats : territoires, seuils et mesures.
11. Export TSV.
12. Roadmap : 1.0 et 1.1 terminées ; Stabilisation 1.1 mentionnée ; audit en 1.5.
13. Build : `npm ci && npm run build` doit réussir sans dépendance à un environnement OpenAI/Cloudflare.

## Avant migration vers les sites Prime

La prochaine vraie évolution d’architecture pourra être faite au moment du déplacement vers l’infrastructure Prime : séparation définitive du prototype HTML historique, configuration des environnements, authentification professionnelle, secrets hors frontend et pipeline de déploiement.

Pour une nouvelle base Prime, ne pas considérer la longue chaîne de migrations de développement comme un cahier métier. Au moment de la migration, créer un **baseline 1.1 à partir de l’état live contrôlé**, puis faire démarrer la nouvelle histoire de migrations à partir de cette baseline. Cela évite d’emporter les tâtonnements de développement dans la future plateforme.
