provider "aws" {
    region= "eu-central-1"
}


resource "aws_security_group" "web_server_sg"{
    name = "web_server_sg"
    description= "Allow port 22(SSH), Allow port 80(HTTP), Allow port 9090 (prometheus), Allow port 3001 (grafana)"
    ingress {
        description = "Allow port 22"
        from_port   = 22
        to_port     = 22
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }


    ingress {
        description = "Allow HTTP request"
        from_port   = 80
        to_port     = 80
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
    
    ingress {
        description = "Allow HTTPS request"
        from_port   = 443
        to_port     = 443
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
    ingress {
        description = "Allow prometheus"
        from_port   = 9090
        to_port     = 9090
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
    ingress {
        description = "Allow Node Exporter"
        from_port   = 9100
        to_port     = 9100
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
    ingress {
        description = "Allow grafana"
        from_port   = 3000
        to_port     = 3000
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
     ingress {
        description = "Allow Website"
        from_port   = 3001
        to_port     = 3001
        protocol    = "tcp"
        cidr_blocks = ["0.0.0.0/0"]
    }
  
    egress {
     description = "Allow all outbound traffic"
     from_port   = 0
     to_port     = 0
     protocol    = "-1"
     cidr_blocks = ["0.0.0.0/0"]
   }

 
}




output "ec2_public_ip" {
    value= aws_instance.web_server.public_ip
} 


output "hosted_zone_zk" {
    value= module.HostedZone.hosted_zone_id 
} 

resource "aws_instance" "web_server" {
    ami= data.aws_ami.ubuntu.id
    instance_type= var.instance_type
    vpc_security_group_ids=[
        aws_security_group.web_server_sg.id
    ]

    tags = {
        Name= var.name
    }
  key_name = "zkKey"
  user_data = templatefile("./Setup/ec2_setup.sh",{})
 
}




module "HostedZone"{
    source="./HostedZone"  
} 
   


module "record" {
    source="./Route53Record"
   ec2_public_ip= aws_instance.web_server.public_ip
    zone_id = module.HostedZone.hosted_zone_id
    domain_name="web.zaink.store"
   
   
}