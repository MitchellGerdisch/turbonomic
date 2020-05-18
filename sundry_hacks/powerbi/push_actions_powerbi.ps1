<#
.SYNOPSIS 

.EXAMPLE
PushTurboActions_PowerBI.ps1 -TurboInstance turbonomic.mycompany.com -TurboCredential $TurboCred -PowerBiCredential $PowerBiKey -AppServerMapCsv appserver.csv
For the servers associated with each applicatin found in the provided CSV, this script will push a separate row of data to the given Power BI stream 
where each row provides the application, the server and action data.

.PARAMETER TurboInstance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER TurboCredential
Specify the credentials for the Turbonomic server. This must be a PSCredential object. You can use the Get-Credential cmdlet to create a variable to store your credentials and then pass the variable to this parameter.

.PARAMETER PowerBiStreamUrl
Currently, this is the URL with the key that one gets when creating a Streaming DataSet set in PowerBI.
(Eventually, this may be replaced with a PowerBI API credentials as configured via registering an app from dev.powerbi.com or a service prinicipal creds.)

.PARAMETER AppServerMapCsv
Specify the path to a CSV that contains at least two columns: 
- Component_id: This is the Application identifier
- Server_Name: This is the server associated with the given component_id.
Note this parameter may become vestigial or replaced once there is an API to get this information.
#>

param (
   [string] $TurboInstance, ## Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.
    
   [System.Management.Automation.CredentialAttribute()] $TurboCredential, ## Specify a PSCredential object. If not provided, you will be prompted.

   [string] $PowerBiStreamUrl, ## The URL with the key that one gets when creating a Streaming DataSet set in PowerBI.

   [string] $AppServerMapCsv ## The path to a CSV that contains at least two columns: Component_Id and Server_Name.
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


# Process the CSV and return an array of JSON data that provides a mapping of the application and related servers.
# This is mostly done to allow for future mechanisms (e.g. API calls) to get this data instead of using a CSV file.
function BuildAppServerMapping($AppServerMapCsv) {
	
	Write-Debug -Message "CSV Path: $AppServerMapCsv"
	
	# Gather the CSV into JSON format for processing
	$CSV_JSON = Import-Csv $AppServerMapCsv |  ConvertTo-Json  | ConvertFrom-Json
	
	$AppServerMapping = @{}
	foreach ($item in $CSV_JSON) {
		$component_id = $item."Component_id"
		$server_name = $item."Server_Name"
		if (-Not $AppServerMapping.ContainsKey($component_id)) {
			# first time finding this component_id, so initialize the associated array
			$AppServerMapping.add($component_id, @{$server_name=@()}) 
		} else {
			if (-Not $AppServermapping.$component_id.ContainsKey($server_name)) { # protects against a given app having the same server name twice. shouldn't happen
				$AppServerMapping.$component_id.add($server_name, @())
			}
		}
	}	
	
	$AppServerMapping
}

function GetServerActions($AppServerMapping, $TurboInstance, $TurboCredential) {
	
	$TurboPassword = $TurboCredential.GetNetworkCredential().password
	$base64AuthInfo = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $TurboCredential.username,$TurboPassword)))

	# Go through the hash and for each app find the servers and for each server find any actions.
	foreach ($appid in $AppServerActions.Keys) {
		foreach ($servername in $AppServerActions.$appid) {
			$vmId = getTuruboVmId($servername, $TurboInstance, $base64AuthInfo)
			Write-Debug "VM: $servername ; UUID: $vmId"
		}
	}
			
}

# Helper function to get UUID for the VM
function getTurboVmId($entityName, $turboInstance, $base64AuthInfo) {
	
	$searchDTO = @{
		"criteriaList" = @(
			@{
				"expType" = "RXEQ"; 
				"expVal" =  "^$entityName\$";
				"filterType" = "vmsByName";
				"caseSensitive" = true
			}
		);
		"logicalOperator" = "AND";
		"className" = "VirtualMachine"
    }
    $searchDTOJson = $searchDTO | ConvertTo-Json
	
	$uri = "https://{0}/vmturbo/rest/search?q=" -f $TurboInstance
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
		$SearchResponse = Invoke-RestMethod -Uri $uri -Method Post -Headers @{Authorization=("Basic {0}" -f $base64AuthInfo); "Content-Type"="application/json"} -Body $searchDTOJson 
		$VmId = $SearchResponse[0].uuid
	} catch {
		Write-Host "Turbonomic API: Error searching for VM, $entityName"
		Write-Host "StatusCode:" $_.Exception.Response.StatusCode.value__ 
    	Write-Host "StatusDescription:" $_.Exception.Response.ReasonPhrase
	}

	$VmId
}



# Take the array of app-specific hashes of actions and send to power bi
function SendDataToPowerBi($PowerBiStreamUrl, $AppServerActions) {
	

$payload = @{
"Server_Name" ="AAAAA555555"
"Action_Details" ="AAAAA555555"
"Component_ID" ="AAAAA555555"
"Timestamp" ="2020-05-18T15:10:45.334Z"
}
Invoke-RestMethod -Method Post -Uri "$endpoint" -Body (ConvertTo-Json @($payload))
	
}	
	
	
	
	
	
	

# Script starts here
$DebugPreference = "Continue"
Write-Debug -Message "Debug mode is currently enabled."

# Allow for self-signed certs
_SetCertPolicy

if(($TurboInstance -eq $null) -or $TurboInstance -eq "") {
	$TurboInstance = Read-Host -Prompt "Enter the IP Address, FQDN, or Hostname of the Turbonomic Server"
}

if($TurboCredential -eq $null) {
	$TurboCredential = Get-Credential -Message "Enter the credentials used to sign in to the Turbonomic server."
}

if(($PowerBiStreamUrl -eq $null) -or $PowerBiStreamUrl -eq "") {
	$PowerBiStreamUrl = Read-Host -Prompt "Enter the Power BI data stream URL"
}

if(($AppServerMapCsv -eq $null) -or $AppServerMapCsv -eq "") {
	$AppServerMapCsv = Read-Host -Prompt "Enter the path to the Application to Server Mapping CSV."
}


# Get the base Application - Server Mappings skeleton built
$AppServerActions = BuildAppServerMapping $AppServerMapCsv	

# Fold in the actions for each server associated with each app
$AppServerActions = GetServerActions $AppServerActions, $TurboInstance $TurboCredential 

### DEBUGGING STUFF ###
#$AppServerActions
foreach ($key in $AppServerActions.Keys) {
	$AppServerActions.$key
}
	
	
