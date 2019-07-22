<#
.EXAMPLE
TurboTarget_UpdateAWSCreds.ps1 -TurboInstance turbonomic.mycompany.com -TurboCredential $TurboCred -AWSAccountID 123456 -AWSCredential $AWSCred
This will update the given AWS target specified by the given AWS account ID and provided AWS credentials on the Turbonomic server turbonomic.mycompany.com using the Turbonomic credentials specified.

.PARAMETER TurboInstance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER TurboCredential
Specify the credentials for the Turbonomic server. This must be a PSCredential object. You can use the Get-Credential cmdlet to create a variable to store your credentials and then pass the variable to this parameter.

.PARAMETER AWSAccountID
Specify the AWS account ID number.

.PARAMETER AWSCredential
Specify the credentials for the AWS account. This must be a PSCredential object where the username is the AWS Access Key ID and the password is the AWS Secret Access Key. 
You can use the Get-Credential cmdlet to create a variable to store your credentials and then pass the variable to this parameter.

#>

param (
    [string] $TurboInstance,
    
    [System.Management.Automation.CredentialAttribute()] $TurboCredential,

    [string] $AWSAccountID,

    [System.Management.Automation.CredentialAttribute()] $AWSCredential
)

# Because Turbonomic is normally installed with self-signed certs, we need PowerShell to allow a self-signed cert.
function _SetCertPolicy {
    if ($PSVersionTable.PSEdition -eq 'Core') {
        if ($PSDefaultParameterValues.Contains("Invoke-RestMethod:SkipCertificateCheck")){
            $PSDefaultParameterValues["Invoke-RestMethod:SkipCertificateCheck"] = $true
        } else {
            $PSDefaultParameterValues.Add("Invoke-RestMethod:SkipCertificateCheck", $true)
        }
        if ($PSDefaultParameterValues.Contains("Invoke-WebRequest:SkipCertificateCheck")){
            $PSDefaultParameterValues["Invoke-WebRequest:SkipCertificateCheck"] = $true
        } else {
            $PSDefaultParameterValues.Add("Invoke-WebRequest:SkipCertificateCheck", $true)
        }
    } else {
        Add-Type -TypeDefinition @"
        using System.Net;
        using System.Security.Cryptography.X509Certificates;
        public class TrustAllCertsPolicy : ICertificatePolicy {
            public bool CheckValidationResult(
                ServicePoint srvPoint, X509Certificate certificate,
                WebRequest request, int certificateProblem) {
                return true;
            }
        }
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object -TypeName TrustAllCertsPolicy
    }
}


# This updates the AWS Account Target in Turbonomic using the Turbonomic REST API
function UpdateAWSTargetCreds($AccountID, $AccessKey, $SecretAccessKey) {

	# Find the target AWS account's UUID - needed for the update action
	$uri = "{0}://{1}/vmturbo/rest/search?q={2}&types=BusinessAccount&regexp=true" -f $protocol, $TurboInstance, $AccountID
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
    	$Response = Invoke-RestMethod -Uri $uri -Headers @{Authorization=("Basic {0}" -f $base64AuthInfo); "Content-Type"="application/json"}
    	$UUID = $Response.targets.uuid
	} catch {
		Write-Host "Turbonomic API: Error finding UUID for account ID, $AccountID"
		Write-Host "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    	Write-Host "StatusDescription:" $_.Exception.Response.ReasonPhrase
		return
	}
    
	# Update the target with the new keys
    $targetDTO = @{
        "category"="Cloud Management";
        "type"="AWS";
        "inputFields"=@(
            @{"value"=$AccessKey;"name"="username"};
            @{"value"=$SecretAccessKey;"name"="password"};
        )
        "uuid"=$UUID;
    }
    $targetDTOJson = $targetDTO | ConvertTo-Json
	$uri = "{0}://{1}/vmturbo/rest/targets/{2}" -f $protocol, $TurboInstance, $UUID
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
    	$UpdateResponse = Invoke-RestMethod -Uri $uri -Method Put -Headers @{Authorization=("Basic {0}" -f $base64AuthInfo); "Content-Type"="application/json"} -Body $targetDTOJson 
    	Write-Host "AWS Response: $UpdateResponse.status"
	} catch {
		Write-Host "Turbonomic API: Error updating credentials for account ID, $AccountID"
		Write-Host "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    	Write-Host "StatusDescription:" $_.Exception.Response.ReasonPhrase
	}
}


function NewLineEndOfFile($fileName) {
    $last_line = Get-Content $fileName -Tail 1
    if($last_line -match "[a-zA-Z]") {
        Add-Content $fileName "`n"
    }
}

# Script starts here
_SetCertPolicy

$protocol = "https"

if(($TurboInstance -eq $null) -or $TurboInstance -eq "") {
	$TurboInstance = Read-Host -Prompt "Enter the IP Address, FQDN, or Hostname of the Turbonomic Server"
}

if($TurboCredential -eq $null) {
	$TurboCredential = Get-Credential -Message "Enter the credentials used to sign in to the Turbonomic server."
}

if(($AWSAccountID -eq $null) -or $AWSAccountID -eq "") {
	$AWSAccountID = Read-Host -Prompt "Enter the AWS Account ID."
}


if($AWSCredential -eq $null) {
	$AWSCredential = Get-Credential -Message "Enter the AWS Access Key ID (username) and AWS Secret Access Key (password) for the given AWS account."
}


$TurboPassword = $TurboCredential.GetNetworkCredential().password
$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $TurboCredential.username,$TurboPassword)))

UpdateAWSTargetCreds $AWSAccountID $AWSCredential.GetNetworkCredential().Username $AWSCredential.GetNetworkCredential().password
	


