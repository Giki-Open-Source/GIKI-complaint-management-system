import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import styles from './dashboard.module.css'
import DashboardLayoutClient from './layout-client'
import SignOutButton from './sign-out-button'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const cookieStore = await cookies()
    const token = cookieStore.get('token')?.value
    const user = token ? await getUserFromToken(token) : null

    if (!user) {
        return <div>Unauthorized</div>
    }

    const sidebarContent = (
        <>
            <div className={styles.logo}>
                <Image src="/giki-logo.png" alt="GIKI logo" width={28} height={28} className={styles.logoImg} />
                GIKomplain
            </div>
            <nav className={styles.nav}>
                <Link href="/dashboard" className={styles.navItem}>Overview</Link>

                {user.role === 'STUDENT' || user.role === 'FACULTY' || user.role === 'STAFF' ? (
                    <>
                        <Link href="/dashboard/submit" className={styles.navItem}>Submit Complaint</Link>
                        <Link href="/dashboard/my-complaints" className={styles.navItem}>My Complaints</Link>
                    </>
                ) : null}

                {user.role === 'DEPT_OFFICER' || user.role === 'ADMIN' ? (
                    <Link href="/dashboard/department" className={styles.navItem}>Department Queue</Link>
                ) : null}

                {user.role === 'ADMIN' && (
                    <>
                        <Link href="/dashboard/admin" className={styles.navItem}>Admin Console</Link>
                        <Link href="/dashboard/admin/users" className={styles.navItem}>Manage Users</Link>
                        <Link href="/dashboard/admin/reports" className={styles.navItem}>Reports</Link>
                    </>
                )}
                <div style={{ marginTop: 'auto' }}>
                    <SignOutButton />
                </div>
            </nav>
            <div className={styles.userProfile}>
                <div className={styles.userName}>{user.name}</div>
                <div className={styles.userRole}>{user.role}</div>
            </div>
        </>
    )

    return (
        <DashboardLayoutClient sidebarContent={sidebarContent}>
            {children}
        </DashboardLayoutClient>
    )
}
