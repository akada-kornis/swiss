# Prime Communes

Observatoire interne du marché communal suisse, construit à partir des données
publiques Delimo P99 de l'Office fédéral de la statistique et enrichi avec les
informations marché de Prime technologies.

## Première version

- 2'110 communes et 8'962'258 habitants attendus au 30.06.2026
- indicateurs nationaux et segment des communes de 10'000 habitants ou plus
- recherche et filtres par canton, logiciel, client Prime et état de livraison
- fiche détaillée Delimo pour chaque commune
- champs préparés pour le logiciel, l'intégrateur, le statut commercial et les notes

Les données sont actuellement stockées dans `public/data/municipalities.json`.
La couche d'affichage est volontairement découplée afin de passer ensuite à une
base persistante sans reconstruire le dashboard.

## Développement

```bash
npm ci
npm run dev
```

Construction de production :

```bash
npm run build
```
