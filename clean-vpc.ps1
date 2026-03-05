param ([string[]]$VpcIds)
foreach ($vpc in $VpcIds) {
    Write-Host "Cleaning VPC: $vpc"
    # IGWs
    $igws = aws ec2 describe-internet-gateways --filters "Name=attachment.vpc-id,Values=$vpc" --query "InternetGateways[].InternetGatewayId" --output text
    if ($igws) {
        foreach ($igw in ($igws -split '\s+' | Where-Object { $_ -ne '' })) {
            Write-Host "Detaching and Deleting IGW $igw"
            aws ec2 detach-internet-gateway --internet-gateway-id $igw --vpc-id $vpc
            aws ec2 delete-internet-gateway --internet-gateway-id $igw
        }
    }

    # Subnets
    $subnets = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpc" --query "Subnets[].SubnetId" --output text
    if ($subnets) {
        foreach ($subnet in ($subnets -split '\s+' | Where-Object { $_ -ne '' })) {
            Write-Host "Deleting Subnet $subnet"
            aws ec2 delete-subnet --subnet-id $subnet
        }
    }

    # Route Tables (excluding Main)
    $rts = aws ec2 describe-route-tables --filters "Name=vpc-id,Values=$vpc" "Name=association.main,Values=false" --query "RouteTables[].RouteTableId" --output text
    if ($rts) {
        foreach ($rt in ($rts -split '\s+' | Where-Object { $_ -ne '' })) {
            Write-Host "Deleting Route Table $rt"
            # First delete associations
            $assocs = aws ec2 describe-route-tables --route-table-ids $rt --query "RouteTables[0].Associations[].RouteTableAssociationId" --output text
            if ($assocs) {
                foreach ($assoc in ($assocs -split '\s+' | Where-Object { $_ -ne '' })) {
                    aws ec2 disassociate-route-table --association-id $assoc
                }
            }
            aws ec2 delete-route-table --route-table-id $rt
        }
    }

    # Custom Security Groups
    $sgs = aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$vpc" --query "SecurityGroups[?GroupName!='default'].GroupId" --output text
    if ($sgs) {
        foreach ($sg in ($sgs -split '\s+' | Where-Object { $_ -ne '' })) {
            Write-Host "Deleting SG $sg"
            aws ec2 delete-security-group --group-id $sg
        }
    }

    # Then VPC
    Write-Host "Deleting VPC $vpc"
    aws ec2 delete-vpc --vpc-id $vpc
}
