'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import styles from './dashboard.module.css'
import { Menu, X } from 'lucide-react'

export default function MobileSidebar({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const pathname = usePathname()

    // Close sidebar on route change
    useEffect(() => {
        setIsOpen(false)
    }, [pathname])

    return (
        <>
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

            <div className={`${styles.layout}`}>
                <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                    {children}
                </aside>

                {/* We don't render children (main content) here because it's rendered by the layout. 
                    This component only wraps the sidebar content to provide the toggle functionality 
                    and renders the mobile header. 
                    
                    Wait, the layout structure needs to be adjusted. 
                    The layout has <aside> and <main>. 
                    I should wrap the whole layout structure or just the sidebar?
                    
                    Better approach: 
                    Create a wrapper that handles the mobile state and renders the structure.
                */}
            </div>
        </>
    )
}
