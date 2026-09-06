import { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { getUserFromToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { isProfileComplete } from '@/lib/profile'
import { UserCircle, LayoutDashboard, FilePlus2, ClipboardList, Inbox, Settings, Building2, UserCog } from 'lucide-react'
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

    const { rows: profileRows } = await query(
        `SELECT "registrationNumber", "hostelName", "roomNumber", "major" FROM "User" WHERE id = $1`,
        [user.id]
    )
    const profileIncomplete = !isProfileComplete({ ...profileRows[0], role: user.role })

    const sidebarContent = (
        <>
            <div className={styles.logo}>
                <Image src="/giki-logo.png" alt="GIKI logo" width={28} height={28} className={styles.logoImg} />
                GIKomplain
            </div>
            <nav className={styles.nav}>
                <Link href="/dashboard" className={styles.navItem}>
                    <LayoutDashboard size={18} />
                    Overview
                </Link>
                {user.role !== 'ADMIN' && (
                    <Link href="/dashboard/profile" className={styles.navItem} style={{ position: 'relative' }}>
                        <UserCircle size={18} />
                        My Profile
                        {profileIncomplete && (
                            <span style={{ width: '8px', height: '8px', backgroundColor: '#eab308', marginLeft: '0.25rem' }} title="Profile incomplete" />
                        )}
                    </Link>
                )}

                {user.role === 'STUDENT' || user.role === 'FACULTY' || user.role === 'STAFF' ? (
                    <>
                        <Link href="/dashboard/submit" className={styles.navItem}>
                            <FilePlus2 size={18} />
                            Submit Complaint
                        </Link>
                        <Link href="/dashboard/my-complaints" className={styles.navItem}>
                            <ClipboardList size={18} />
                            My Complaints
                        </Link>
                    </>
                ) : null}

                {user.role === 'DEPT_OFFICER' && (
                    <Link href="/dashboard/department" className={styles.navItem}>
                        <Inbox size={18} />
                        Department Queue
                    </Link>
                )}

                {user.role === 'ADMIN' && (
                    <>
                        <Link href="/dashboard/admin/hostels" className={styles.navItem}>
                            <Building2 size={18} />
                            Hostel Complaints
                        </Link>
                        <Link href="/dashboard/admin/supervisors" className={styles.navItem}>
                            <UserCog size={18} />
                            Supervisors
                        </Link>
                    </>
                )}
                <div style={{ marginTop: 'auto' }}>
                    <Link href="/dashboard/settings" className={styles.navItem}>
                        <Settings size={18} />
                        Settings
                    </Link>
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
