import Image from "next/image";
import Link from "next/link";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/" className={styles.brand} aria-label="AI Clinics — inicio">
          <Image
            src="/logo.png"
            alt="AI Clinics"
            width={160}
            height={36}
            priority
            className={styles.logo}
          />
        </Link>
      </div>
      <div className={styles.right}>
        <span className={styles.avatar}>SR</span>
      </div>
    </header>
  );
}
