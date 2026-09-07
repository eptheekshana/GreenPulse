function showPinModal() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'pin-modal-overlay';
        
        overlay.innerHTML = `
            <div class="pin-modal-card">
                <h3><i class="ph-bold ph-lock"></i> Authentication Required</h3>
                <p>Please enter the security PIN to turn on the pump.</p>
                <div class="pin-input-group">
                    <input type="password" id="pin-input" maxlength="4" placeholder="••••" autocomplete="off" />
                </div>
                <div class="pin-modal-actions">
                    <button class="btn btn-outline" id="pin-cancel" style="border: 1px solid var(--border-color); color: #fff; background: transparent; transition: all 0.2s;">Cancel</button>
                    <button class="btn btn-primary" id="pin-confirm" style="background: var(--accent-green); color: #000; border: none; font-weight: 600; transition: all 0.2s;">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('pin-input');
        const btnCancel = document.getElementById('pin-cancel');
        const btnConfirm = document.getElementById('pin-confirm');

        input.focus();

        const close = (value) => {
            if (document.body.contains(overlay)) {
                overlay.style.animation = 'pinFadeOut 0.2s ease forwards';
                overlay.querySelector('.pin-modal-card').style.animation = 'pinSlideDown 0.2s ease forwards';
                setTimeout(() => document.body.removeChild(overlay), 200);
            }
            resolve(value);
        };

        btnCancel.onclick = () => close(null);
        btnConfirm.onclick = () => close(input.value);
        input.onkeydown = (e) => {
            if (e.key === 'Enter') close(input.value);
            if (e.key === 'Escape') close(null);
        };
    });
}
