# What existed in the dashboard before the zone came into Terraform, adopted
# instead of duplicated. Once applied, an import block is a no-op: delete
# these in the next change to the stack. Ids from GET /zones/<id>/dns_records
# and GET /zones/<id>/rulesets.

import {
  for_each = {
    "AAAA studioart.cz"     = "efb94542d2599b625f9b0bd25c571620"
    "A www.studioart.cz"    = "2fc880a1223cd80850b4a71443a23093"
    "AAAA www.studioart.cz" = "e87f5a5df92fd2154d66d17037514fc1"
    "A *.studioart.cz"      = "1b5f25b21f9346f876437c7e457b4651"
    "AAAA *.studioart.cz"   = "aff0b9013311328f6ec4eb3269fe7991"
  }
  to = module.studioart_cz.module.redirect.cloudflare_dns_record.placeholder[each.key]
  id = "${module.studioart_cz.zone_id}/${each.value}"
}

import {
  to = module.studioart_cz.module.redirect.cloudflare_ruleset.redirect
  id = "zones/${module.studioart_cz.zone_id}/d0f74a19d4444504953a3d90ce7fc3d7"
}

import {
  for_each = {
    "aspmx.l.google.com"      = "ff4cce63c45a4782af6ccfb292d2edd6"
    "alt1.aspmx.l.google.com" = "7c16622a548702d804b684e07802936c"
    "alt2.aspmx.l.google.com" = "bb84152ed3e4c1cbe34b3d99704ebb7a"
    "aspmx2.googlemail.com"   = "2b1027458e8a436ae2f6eab27b5985f1"
    "aspmx3.googlemail.com"   = "416d0362746654fa7d3a6b41e74de851"
    "aspmx4.googlemail.com"   = "0663819d236e57c7f64fd8bd305f78d6"
    "aspmx5.googlemail.com"   = "fa4fb8d89851d5f8a2d688943540c14f"
  }
  to = module.studioart_cz.module.mail.cloudflare_dns_record.mx[each.key]
  id = "${module.studioart_cz.zone_id}/${each.value}"
}

import {
  to = module.studioart_cz.cloudflare_dns_record.google_site_verification
  id = "${module.studioart_cz.zone_id}/bbd2fc902ba1533403c7568d88f890c4"
}

import {
  to = module.studioart_cz.cloudflare_dns_record.github_pages_challenge
  id = "${module.studioart_cz.zone_id}/5a6a174d3510f0893f72c3dd1abfb725"
}
