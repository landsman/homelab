; <?php exit; ?> DO NOT REMOVE THIS LINE
; Mounted read-only into the container. Matomo merges it under its own
; config.ini.php (which holds the salt and DB settings the installer writes), so
; these stay in git and survive a reinstall.
;
; Matomo sits behind a Cloudflare Tunnel: without these it would log
; Cloudflare's IPs instead of visitors', and build http:// links on an
; https:// site.
[General]
assume_secure_protocol = 1
proxy_client_headers[] = "HTTP_CF_CONNECTING_IP"
