variable "domain_name" {}
variable "zone_id" {}
variable "ec2_public_ip" {}

resource "aws_route53_record" "app" {
    zone_id = var.zone_id
    name    = var.domain_name
    type    = "A"
    ttl     = 300

    records = [var.ec2_public_ip]
} 