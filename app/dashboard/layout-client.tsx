'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import styles from './dashboard.module.css'
import { Menu, X } from 'lucide-react'

export default function DashboardLayoutClient({
    sidebarContent,
    children
}: {
    sidebarContent: React.ReactNode
    children: React.ReactNode
}) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()

    // Close sidebar on route change
    useEffect(() => {
        setIsOpen(false)
    }, [pathname])

    return (
        <div className={styles.layout}>
            <div className={styles.mobileHeader}>
                <div className={styles.logo} style={{ marginBottom: 0 }}>
                    <Image src="/giki-logo.png" alt="GIKI logo" width={24} height={24} className={styles.logoImg} />
                    GIKomplain
                </div>
                <button className={styles.menuButton} onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            <div
                className={`${styles.overlay} ${isOpen ? styles.open : ''}`}
                onClick={() => setIsOpen(false)}
            />

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                {sidebarContent}
            </aside>

            <main className={styles.main}>
                {children}
            </main>
        </div>
    )
}
