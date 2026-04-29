import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <span className={styles.tag}>AI Clinics — Lab10</span>
        <h1 className={styles.title}>
          Diagnóstico y roadmap de adopción de IA en vivo.
        </h1>
        <p className={styles.subtitle}>
          Web app del facilitador. Etapa 1: fundación del proyecto.
        </p>
      </main>
    </div>
  );
}
