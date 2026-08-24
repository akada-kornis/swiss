"use client";

import { useEffect, useMemo, useState } from "react";

type Municipality = {
  id: number; name: string; canton: string; market: string;
  expectedPopulation: number; receivedPopulation: number | null; receivedOn: string;
  comment: string; echVersion: string; missingEwid: number | null; ewidErrorRate: number | null;
  deliveryStatus: "accepted" | "warning" | "invalid" | "missing" | "unknown";
  software: string; integrator: string; isPrime: boolean; salesStatus: string; notes: string;
};
type Dataset = { meta: { referenceDate: string; municipalityCount: number; expectedPopulation: number }; municipalities: Municipality[] };
type DatabaseMunicipality = {
  bfs_id: number; name: string; canton: string; market: string;
  expected_population: number; received_population: number | null; received_on: string | null;
  comment: string | null; ech_version: string | null; missing_ewid: number | null; ewid_error_rate: number | null;
  delivery_status: Municipality["deliveryStatus"] | null; integrator: string | null; software: string | null;
  sales_status: string | null; notes: string | null; reference_date: string | null;
};
const number = new Intl.NumberFormat("fr-CH");
const supabaseUrl = "https://ozdvmllgxduzquiujcbg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZHZtbGxneGR1enF1aXVqY2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzkwNTIsImV4cCI6MjEwMzE1NTA1Mn0.mVT0_dqcpAzb3QxmC5xDmB8bq7RZrpDd5dpvnGKPaTw";
const supplierChoices = ["Prime", "Data", "Ofisa", "T2i", "SIACG", "OBT", "Talus", "Etic@SIEN", "Ciges"];
const softwareChoices = ["innosolvcity", "Urbanus", "Calvin", "Calvin | eAdmin"];

function StatusDot({ status }: { status: Municipality["deliveryStatus"] }) {
  const label = status === "accepted" ? "Acceptée" : status === "warning" ? "Attention" : status === "missing" ? "Non livrée" : "Erreur";
  return <span className={`status-dot ${status}`} title={label} aria-label={label} />;
}

export default function Dashboard() {
  const [data, setData] = useState<Dataset | null>(null);
  const [dataSource, setDataSource] = useState<"database" | "fallback" | "loading">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [canton, setCanton] = useState("Tous");
  const [software, setSoftware] = useState("Tous");
  const [primeOnly, setPrimeOnly] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [ofsMode, setOfsMode] = useState(false);
  const [selected, setSelected] = useState<Municipality | null>(null);
  const [sort, setSort] = useState<{ key: "population" | "name"; direction: "asc" | "desc" }>({ key: "population", direction: "desc" });

  const loadData = async () => {
    setRefreshing(true);
    try {
      const rows: DatabaseMunicipality[] = [];
      for (let from = 0; ; from += 1000) {
        const response = await fetch(`${supabaseUrl}/rest/v1/GemeindeAktuell?select=*&order=bfs_id`, {
          headers: { apikey: supabaseKey, Range: `${from}-${from + 999}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Supabase ${response.status}`);
        const page = await response.json() as DatabaseMunicipality[];
        rows.push(...page);
        if (page.length < 1000) break;
      }
      const municipalities = rows.map((item): Municipality => ({
        id: item.bfs_id, name: item.name, canton: item.canton, market: item.market,
        expectedPopulation: item.expected_population ?? 0, receivedPopulation: item.received_population,
        receivedOn: item.received_on ?? "", comment: item.comment ?? "", echVersion: item.ech_version ?? "",
        missingEwid: item.missing_ewid, ewidErrorRate: item.ewid_error_rate,
        deliveryStatus: item.delivery_status ?? "unknown", software: item.software ?? "",
        integrator: item.integrator ?? "", isPrime: item.integrator === "Prime",
        salesStatus: item.sales_status ?? "none", notes: item.notes ?? "",
      }));
      const referenceDate = rows.find((item) => item.reference_date)?.reference_date ?? "";
      setData({ meta: { referenceDate, municipalityCount: municipalities.length, expectedPopulation: municipalities.reduce((sum, item) => sum + item.expectedPopulation, 0) }, municipalities });
      setDataSource("database");
    } catch {
      const response = await fetch("/data/municipalities.json");
      setData(await response.json());
      setDataSource("fallback");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { void loadData(); }, []);
  const municipalities = data?.municipalities ?? [];
  const cantons = useMemo(() => [...new Set(municipalities.map((item) => item.canton))].sort(), [municipalities]);
  const integrators = useMemo(() => [...new Set(municipalities.map((item) => item.integrator).filter(Boolean))].sort(), [municipalities]);
  const filtered = useMemo(() => municipalities.filter((item) => {
    const needle = query.trim().toLocaleLowerCase("fr-CH");
    return (!needle || `${item.name} ${item.canton} ${item.software} ${item.integrator}`.toLocaleLowerCase("fr-CH").includes(needle))
      && (canton === "Tous" || item.canton === canton) && (software === "Tous" || item.integrator === software)
      && (!primeOnly || item.isPrime) && (!issuesOnly || item.deliveryStatus !== "accepted");
  }).sort((a, b) => {
    const comparison = sort.key === "population"
      ? a.expectedPopulation - b.expectedPopulation
      : a.name.localeCompare(b.name, "fr-CH", { sensitivity: "base" });
    return sort.direction === "asc" ? comparison : -comparison;
  }), [municipalities, query, canton, software, primeOnly, issuesOnly, sort]);
  const changeSort = (key: "population" | "name") => setSort((current) => current.key === key
    ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
    : { key, direction: key === "population" ? "desc" : "asc" });
  const stats = useMemo(() => {
    const over10k = municipalities.filter((item) => item.expectedPopulation >= 10_000);
    const prime = municipalities.filter((item) => item.isPrime);
    return { over10k: over10k.length, over10kPopulation: over10k.reduce((sum, item) => sum + item.expectedPopulation, 0), prime: prime.length, primePopulation: prime.reduce((sum, item) => sum + item.expectedPopulation, 0), issues: municipalities.filter((item) => item.deliveryStatus !== "accepted").length };
  }, [municipalities]);
  const reset = () => { setQuery(""); setCanton("Tous"); setSoftware("Tous"); setPrimeOnly(false); setIssuesOnly(false); };

  return <main className="app-shell">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="topbar">
      <img src="/prime-logo.png" className="brand" alt="Prime technologies" />
      <nav className="nav-tabs" aria-label="Navigation principale"><button className="nav-tab active">Vue d’ensemble</button><button className="nav-tab">Communes</button><button className="nav-tab">Analyses</button></nav>
      <button className="sync-state" onClick={() => void loadData()} disabled={refreshing} title="Recharger les données depuis Supabase"><span /> {refreshing ? "Actualisation…" : `Données au ${data?.meta.referenceDate ? new Date(`${data.meta.referenceDate}T00:00:00`).toLocaleDateString("fr-CH") : "—"}`} · {dataSource === "fallback" ? "copie locale" : "base live"}</button>
    </header>
    <section className="workspace">
      <div className="intro-row"><div><p className="eyebrow">Marché suisse · Delimo P99</p><h1>Les communes.<br /><span>Enfin lisibles.</span></h1></div><p className="intro-copy">Une vue unique du marché communal suisse : population, qualité des livraisons, logiciels et opportunités.</p></div>
      <section className="kpi-grid" aria-label="Indicateurs clés">
        <article className="kpi-card hero-kpi"><div className="kpi-top"><span className="kpi-label">Population couverte</span><span className="kpi-badge">100%</span></div><strong>{data ? number.format(data.meta.expectedPopulation) : "—"}</strong><p>habitants attendus · {data?.meta.municipalityCount ?? "—"} communes</p><div className="sparkline"><i /><i /><i /><i /><i /><i /><i /></div></article>
        <article className="kpi-card"><span className="kpi-label">Communes ≥ 10’000</span><strong>{stats.over10k}</strong><p>{number.format(stats.over10kPopulation)} habitants · 49,5% du pays</p></article>
        <article className="kpi-card prime-card"><div className="kpi-top"><span className="kpi-label">Clients Prime</span><img className="prime-one" src="/prime-one-negative.png" alt="Prime" /></div><strong>{stats.prime}</strong><p>{number.format(stats.primePopulation)} habitants identifiés</p></article>
        <button className={`kpi-card alert-card ${ofsMode ? "ofs-active" : ""}`} onClick={() => { setOfsMode(!ofsMode); if (ofsMode) setIssuesOnly(false); }}><span className="kpi-label">Contrôle OFS</span><strong>{ofsMode ? stats.issues : "Ouvrir"}</strong><p>{ofsMode ? "livraisons à surveiller" : "Afficher les statuts Delimo"} <span>→</span></p></button>
      </section>
      <section className="data-panel">
        <div className="panel-heading"><div><p className="eyebrow">Explorateur</p><h2>2’110 communes, une seule vue</h2></div><button className="ghost-button">Exporter la sélection</button></div>
        <div className="filters">
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une commune, un logiciel…" /></label>
          <label><span>Canton</span><select value={canton} onChange={(event) => setCanton(event.target.value)}><option>Tous</option>{cantons.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Intégrateur</span><select value={software} onChange={(event) => setSoftware(event.target.value)}><option>Tous</option>{integrators.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button className={`filter-toggle ${primeOnly ? "on" : ""}`} onClick={() => setPrimeOnly(!primeOnly)}>Clients Prime</button>{ofsMode && <button className={`filter-toggle ${issuesOnly ? "on warning" : ""}`} onClick={() => setIssuesOnly(!issuesOnly)}>À surveiller</button>}
        </div>
        <div className="result-line"><strong>{number.format(filtered.length)}</strong> résultats <button onClick={reset}>Réinitialiser</button></div>
        <div className="table-wrap"><table><thead><tr>{ofsMode && <th>État</th>}<th className="sortable" onClick={() => changeSort("name")}>Commune {sort.key === "name" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</th><th>Marché</th><th>Canton</th><th className="sortable" onClick={() => changeSort("population")}>Population {sort.key === "population" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</th><th>Intégrateur</th><th>Logiciel</th>{ofsMode && <th>Erreur EWID</th>}<th /></tr></thead><tbody>{filtered.slice(0, 120).map((item) => <tr key={item.id} onClick={() => setSelected(item)}>{ofsMode && <td><StatusDot status={item.deliveryStatus} /></td>}<td><strong>{item.name}</strong>{item.isPrime && <span className="client-pill">Prime</span>}</td><td>{item.market}</td><td>{item.canton}</td><td className="numeric">{number.format(item.expectedPopulation)}</td><td>{item.integrator || <span className="empty">À compléter</span>}</td><td>{item.software || <span className="empty">—</span>}</td>{ofsMode && <td><span className={`rate ${(item.ewidErrorRate ?? 0) > 1 ? "high" : ""}`}>{item.ewidErrorRate?.toFixed(1) ?? "—"}%</span></td>}<td className="arrow">›</td></tr>)}</tbody></table>{filtered.length > 120 && <p className="table-limit">120 premiers résultats affichés · affinez les filtres pour aller plus loin</p>}</div>
      </section>
    </section>
    {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><button className="drawer-close" onClick={() => setSelected(null)}>×</button><div className="drawer-title">{ofsMode && <StatusDot status={selected.deliveryStatus} />}<div><p>{selected.canton} · OFS {selected.id}</p><h2>{selected.name}</h2></div></div><div className="drawer-pop"><strong>{number.format(selected.expectedPopulation)}</strong><span>habitants attendus</span></div>{ofsMode && <section><h3>Livraison Delimo</h3><dl><div><dt>Population reçue</dt><dd>{number.format(selected.receivedPopulation ?? 0)}</dd></div><div><dt>Erreur EWID</dt><dd>{selected.ewidErrorRate?.toFixed(1)}%</dd></div><div><dt>EWID manquants</dt><dd>{selected.missingEwid?.toFixed(1)}%</dd></div><div><dt>Version eCH</dt><dd>{selected.echVersion}</dd></div></dl><p className="delivery-comment">{selected.comment}</p></section>}<section><h3>Connaissance marché</h3><label>Intégrateur<select defaultValue={selected.integrator}><option value="">Non renseigné</option>{[...new Set([...supplierChoices, selected.integrator].filter(Boolean))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label>Logiciel<select defaultValue={selected.software}><option value="">Non renseigné</option>{[...new Set([...softwareChoices, selected.software].filter(Boolean))].sort().map((value) => <option key={value}>{value}</option>)}</select></label><label>Statut commercial<select defaultValue={selected.salesStatus}><option value="none">Non qualifié</option><option>À cibler</option><option>En discussion</option><option>Client</option></select></label><label>Notes<textarea defaultValue={selected.notes} placeholder="Informations utiles, contexte, prochaine étape…" /></label><button className="save-button">Enregistrer les informations</button><p className="prototype-note">V0 locale · l’enregistrement sera activé avec la base de données</p></section></aside></div>}
  </main>;
}
