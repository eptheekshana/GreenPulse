document.addEventListener('DOMContentLoaded', () => {
    const notifBtn = document.getElementById('notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');
    const notifBadge = document.getElementById('notif-badge');

    if (notifBtn) {
        notifBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const isShowing = notifDropdown.classList.contains('show');
            if (!isShowing) {
                try {
                    const res = await fetch('/api/pump-history');
                    if (res.ok) {
                        const events = await res.json();
                        notifBadge.innerText = events.length;
                        if (events.length === 0) {
                            notifList.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--text-muted); font-size:0.9rem;">No new notifications</div>';
                        } else {
                            let html = '';
                            events.slice(0, 10).forEach(ev => {
                                const d = new Date(ev.timestamp);
                                const timeStr = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
                                const colorClass = ev.state === 'ON' ? 'success' : 'warning';
                                const bg = ev.state === 'ON' ? 'var(--accent-green)' : 'var(--accent-yellow)';
                                const color = ev.state === 'ON' ? '#fff' : '#000';
                                html += `
                                <div style="display:flex; align-items:center; gap:12px; margin-bottom:0.5rem; padding:0.5rem; border-bottom:1px solid var(--border-color);">
                                    <div style="width:32px;height:32px;font-size:1rem;border-radius:50%;display:flex;align-items:center;justify-content:center;background-color:${bg}; color:${color};"><i class="ph-bold ph-power"></i></div>
                                    <div style="flex:1;">
                                        <div style="font-size:0.85rem;">Pump turned ${ev.state}</div>
                                        <div style="font-size:0.75rem; color:var(--text-muted);"><i class="ph-bold ph-clock"></i> ${timeStr}</div>
                                    </div>
                                </div>`;
                            });
                            notifList.innerHTML = html;
                        }
                    }
                } catch (e) {
                    console.error("Failed to load notifs", e);
                }
            }
            notifDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
                notifDropdown.classList.remove('show');
            }
        });
    }
    
    // Poll initially
    fetch('/api/pump-history').then(res => res.json()).then(events => {
        if(notifBadge) notifBadge.innerText = events.length;
    }).catch(e => {});

    // Sidebar toggle logic
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('open');
        });
        
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });
    }
});
