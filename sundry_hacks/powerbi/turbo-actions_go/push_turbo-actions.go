package main

/*
.SYNOPSIS 

.DESCRIPTION
Pushes records to Power BI streaming dataset that provide application-server-actions information.
Requires a Power BI streaming dataset defined with the following fields:
- Timestamp (DateTime)
- Component_ID (Text)
- Component_Name (Text)
- Server_Name (Text)
- Action_Details (Text)
- Action_Type (Text)
- Action_From (Text)
- Action_To (Text)

.EXAMPLE
PushTurboActions_PowerBI.ps1 -TurboInstance turbonomic.mycompany.com -TurboCredential $TurboCred -PowerBiCredential $PowerBiKey -AppServerMapCsv appserver.csv
For the servers associated with each applicatin found in the provided CSV, this script will push a separate row of data to the given Power BI stream 
where each row provides the application, the server and action data.

.PARAMETER turbo_instance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER turbo_user
Specify the username for accessing Turbo. 

.PARAMETER turbo_password
Specify the password for accessing Turbo. 

.PARAMETER powerbi_stream_url
Currently, this is the URL with the key that one gets when creating a Streaming DataSet set in PowerBI.
(Eventually, this may be replaced with a PowerBI API credentials as configured via registering an app from dev.powerbi.com or a service prinicipal creds.)

.PARAMETER csv_file
Specify the path to a CSV that contains at least two columns: 
- Component_Id: This is the Application identifier
- Server_Name: This is the server associated with the given component_id.
Note this parameter may become vestigial or replaced once there is an API to get this information.

CROSS-COMPLIATION NOTES
env GOOS=windows GOARCH=amd64 go build ./push_turbo-actions.go

*/

import (
    "bytes"
 	"mime/multipart"
	"encoding/json"
	"strings"
	"strconv"
    "fmt"
    "io/ioutil"
    "net/http"
    "crypto/tls"
    "flag"
    "os"
    "encoding/csv"
    "io"
    "time"
    //"reflect"
)

type Action struct {
	actionUuid string
	actionDetails string
	actionType string
	actionFrom string
	actionTo string
}

type ServerAction struct {
	serverName string
	serverUuid string
	actions []Action
}

type AppServerMapping struct {
	appId string
	appName string
	serverActions []ServerAction
}

func main() {
	// Process command line arguments
	turbo_user := flag.String("turbo_user", "", "Turbo Username")
	turbo_password:= flag.String("turbo_password", "", "Turbo Password")
	turbo_instance := flag.String("turbo_instance", "", "Turbo IP or FQDN")
	csv_file := flag.String("csv_file", "", "CSV File containing App to Server mapping - \"Component_id\" and \"Server_Name\" columns required")
	powerbi_stream_url := flag.String("powerbi_stream_url", "", "URL for the PowerBI Stream Dataset")

	flag.Parse()
	
	if ((*turbo_user == "") || (*turbo_password == "") || (*turbo_instance == "") || (*csv_file == "") || (*powerbi_stream_url == "")) {
		fmt.Println("*************")
		fmt.Println("Missing command line argument ...")
		fmt.Println("Run \""+os.Args[0]+" -h\" for more information.")
		fmt.Println("*************")
		os.Exit(1)
	}
	// end command line arguments
	
	// Process the CSV file to extract the Application to Server Mapping
	fmt.Println("Processing CSV file for application to server mapping ...")
	var appServerMapping  []AppServerMapping
	appServerMapping = getAppServerMapping(*csv_file)


	// Call Turbo to get any actions for the servers assigned to each application
	fmt.Println("Getting actions from Turbo ...")
	appServerMapping = addAppServerActions(appServerMapping, *turbo_instance, *turbo_user, *turbo_password)

	// Call PowerBI API to push data to the stream dataset
	fmt.Println("Sending records to PowerBI ...")
	pushPowerBiData(appServerMapping, *powerbi_stream_url)
	
	fmt.Println("Done.")
}

// Processes the CSV and creates a base mapping of applications (aka components) and servers
func getAppServerMapping(csv_file string) []AppServerMapping {

	// Get size of file and application and server name column numbers for subsequent processing
	var componentIdColumn, componentNameColumn, serverNameColumn int
	_, componentIdColumn, componentNameColumn, serverNameColumn = getFileInfo(csv_file)
	
	// For storing the app to server mappings (and later the server actions)
	var appServerMapping []AppServerMapping
	var currentApp,blankApp AppServerMapping
	//blankApp.appId = "nowayanythingisnamedthis"
	currentApp = blankApp
	
	// For storing servers associated with a given app
	// The actions part will be filled in later
	var server ServerAction
	
	// Read through the file this time to build the application to server mapping
	fileLine := 1
	appservercsv, err := os.Open(csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ csv_file)
		os.Exit(5)
	}

	readfile := csv.NewReader(appservercsv)
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	

		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		} else {
			// Skip the first line which contains the column headings
			if (fileLine > 1) {
				// Check if we have come across a new application name
				if (currentApp.appId != record[componentIdColumn]) {
					// We've got a new app, so push the current on to the array if it's not the initial loop and start a new one
					if (currentApp.appId != "") {
						appServerMapping = append(appServerMapping, currentApp)
					}
					currentApp = blankApp
					currentApp.appId = record[componentIdColumn]
					currentApp.appName = record[componentNameColumn]
				} 

				// store the server associated with the current app
				server.serverName = record[serverNameColumn]
				currentApp.serverActions = append(currentApp.serverActions, server)
			}	
			fileLine += 1
		}
	}	
	
	// Add the last serverActions block
	appServerMapping = append(appServerMapping, currentApp)

	return appServerMapping
}

// Adds the actions to the app-server mapping structure
func addAppServerActions(appServerMapping []AppServerMapping, turbo_instance string, turbo_user string, turbo_password string) []AppServerMapping {
	// Turbo authentication
	auth := turboLogin(turbo_instance, turbo_user, turbo_password) 
	
	// Each item from appServerMapping is a structure containing the application ID and 
	var serverUuid string
	for _,app := range appServerMapping {
		fmt.Println("Getting actions for servers in Application: "+app.appName)
		for srv_idx,server := range app.serverActions {
			// Get the actions for the given server and add to the given server's actions struct
			// If the server is not found, it'll be marked as NOTFOUND and we can catch that later if needed
			serverUuid = getVmId(turbo_instance, server.serverName, auth ) 
			app.serverActions[srv_idx].serverUuid = serverUuid
			if (serverUuid != "NOTFOUND") {
				app.serverActions[srv_idx].actions = getServerActions(turbo_instance, serverUuid, auth) 
			}
		}
	}
	return appServerMapping
}

func pushPowerBiData(appServerMapping []AppServerMapping, powerbi_url string) {

	t := time.Now()
	timeString := t.Format(time.RFC3339)
  	method := "POST"
	
	for _,app := range appServerMapping {
		for _,server := range app.serverActions {
			for _,action := range server.actions {
				timestamp_part := "\"Timestamp\": \""+timeString+"\""
				appid_part := "\"Component_ID\": \""+app.appId+"\""
				appname_part := "\"Component_Name\": \""+app.appName+"\""
				servername_part := "\"Server_Name\": \""+server.serverName+"\""
				actiondetails_part := "\"Action_Details\": \""+action.actionDetails+"\""
				actiontype_part := "\"Action_Type\": \""+action.actionType+"\""
				actionfrom_part := "\"Action_From\": \""+action.actionFrom+"\""
				actionto_part := "\"Action_To\": \""+action.actionTo+"\""
				
				payload := strings.NewReader("[{"+timestamp_part+","+appid_part+","+appname_part+","+servername_part+","+actiondetails_part+","+actiontype_part+","+actionfrom_part+","+actionto_part+"}]")
				
				client := &http.Client {}
  				req, err := http.NewRequest(method, powerbi_url, payload)
  				if err != nil {
    				fmt.Println(err)
  				}
  				req.Header.Add("Content-Type", "application/json")
	
  				res, _:= client.Do(req)
  				defer res.Body.Close()
  			}
	  	}
	}
}

// Does basic processing of the csv file
func getFileInfo(csv_file string) (int, int, int, int) {
	
	// Open the file
	appservercsv, err := os.Open(csv_file)
	if (err != nil) {
		fmt.Println("*** Error opening file: "+ csv_file)
		os.Exit(5)
	}
	readfile := csv.NewReader(appservercsv)

	// Run through the file and find the number of lines in the file and the columns that have the server name and app (i.e. component) id
	numLines := 0
	
	componentIdColName := "Component_id"
	componentIdColumn := -1 
	componentNameColName := "Component_Name"
	componentNameColumn := -1 
	serverNameColName := "Server_Name"
	serverNameColumn := -1
	columnNameLine := -1
	for {
		record, err := readfile.Read()
		if (err == io.EOF) {
			break
		}	

		if (err != nil) {
			fmt.Println("*** Failed to read a record in CSV file.") 
		} else {
			numLines += 1

			for index,content := range record {
				if (content == componentIdColName) {
					componentIdColumn = index
					columnNameLine = numLines
				}  else if (content == serverNameColName) {
					serverNameColumn = index	
					columnNameLine = numLines
				}	else if (content == componentNameColName) {
					componentNameColumn = index	
					columnNameLine = numLines
				}
			}
		}
	}

	if (columnNameLine != 1) {
		// The CSV file needs to have the column headers at the top otherwise
		fmt.Println("*** CSV file MUST have the column names on the first line of the file. ***")
		os.Exit(10)
	}	
	
	if (componentIdColumn < 0) {
		fmt.Println("*** No \""+componentIdColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}
	
	if (componentNameColumn < 0) {
		fmt.Println("*** No \""+componentNameColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}

	if (serverNameColumn < 0) {
		fmt.Println("*** No \""+serverNameColName+"\" column found.")
		fmt.Println("*** Either the column heading is not there, or there's some weird ufeff character in that row.")
		os.Exit(11)
	}
	
	return numLines, componentIdColumn, componentNameColumn, serverNameColumn
}

// Get actions for given server UUID
func getServerActions (turbo_instance string, server_id string,  auth string) []Action {
	url := "https://"+ turbo_instance +"/vmturbo/rest/entities/"+ server_id +"/actions" 
	method := "GET"
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	// create and make the request
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Cookie", auth)
	res, err := client.Do(req)
	if err != nil {
    	fmt.Println(err)
    	os.Exit(3)
  	}

	defer res.Body.Close()
	// essentially creates a stringified version of the body's json
	body, _ := ioutil.ReadAll(res.Body)
	
	// Since the search results is an array of json,
	// Create an array of one of these interface things to unmarshal the stringified json into
	var responseActions []map[string]interface{}
	err = json.Unmarshal([]byte(body), &responseActions)
	if err != nil {
		fmt.Println(err)
    	os.Exit(4)
	}

	var serverActions []Action
	var riskcommodity string
	var fromval, toval float64
	for _, responseAction := range responseActions {
		var serverAction Action
		serverAction.actionUuid = responseAction["uuid"].(string)
		serverAction.actionType = responseAction["actionType"].(string)
		serverAction.actionDetails = responseAction["details"].(string)
		if  (responseAction["target"].(map[string]interface{})["environmentType"] == "CLOUD") {
			serverAction.actionFrom = responseAction["currentEntity"].(map[string]interface{})["displayName"].(string)
			serverAction.actionTo = responseAction["newEntity"].(map[string]interface{})["displayName"].(string)
		} else {
			riskcommodity = responseAction["risk"].(map[string]interface{})["reasonCommodity"].(string)
			if (riskcommodity == "VCPU") {
				// Get CPU values (in float)
				fromval, _ = strconv.ParseFloat(responseAction["currentValue"].(string), 32)
				toval, _ = strconv.ParseFloat(responseAction["resizeToValue"].(string), 32)
				// Convert from float to int
				serverAction.actionFrom = strconv.Itoa(int(fromval))
				serverAction.actionTo = strconv.Itoa(int(toval))
			} else if (riskcommodity == "VMem") {
				fromval, _ = strconv.ParseFloat(responseAction["currentValue"].(string), 32)
				// Convert to GB
				fromval = (fromval/(1024*1024))
				toval, _ = strconv.ParseFloat(responseAction["resizeToValue"].(string), 32)
				// Convert to GB
				toval = (toval/(1024*1024))
				// Convert from float to int
				serverAction.actionFrom = strconv.Itoa(int(fromval))
				serverAction.actionTo = strconv.Itoa(int(toval))
			} else {
				serverAction.actionFrom = "NA"
				serverAction.actionTo = "NA"
			}

		}
		serverActions = append(serverActions, serverAction)
	}
	
	return serverActions
}	

// get VM UUID
func getVmId(turbo_instance string, server_name string, auth string) string {

	url := "https://"+ turbo_instance +"/api/v3/search?q="
	method := "POST"
	
	// VM search payload
	vm_payload := strings.NewReader("{\n  \"className\": \"VirtualMachine\",\n  \"criteriaList\": [\n    {\n      \"expVal\": \"^"+server_name+"$\",\n      \"caseSensitive\": \"\",\n      \"filterType\": \"vmsByName\",\n      \"expType\": \"RXEQ\"\n    }\n  ],\n  \"logicalOperator\": \"AND\"\n}")
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	// create and make the request
	req, err := http.NewRequest(method, url, vm_payload)
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Cookie", auth)
	res, err := client.Do(req)
	if err != nil {
    	fmt.Println(err)
    	os.Exit(3)
  	}

	defer res.Body.Close()
	// essentially creates a stringified version of the body's json
	body, _ := ioutil.ReadAll(res.Body)
	//fmt.Println(string(body))
	
	// Since the search results is an array of json,
	// Create an array of one of these interface things to unmarshal the stringified json into
	var searchResults []map[string]interface{}
	err = json.Unmarshal([]byte(body), &searchResults)
	if err != nil {
		fmt.Println(err)
    	os.Exit(4)
	}
	// now searchResults is an array of structures that we can index.
	// There's only one result so we're hardcoding the array index and we only care about the uuid
	//fmt.Println("searchResults")
	//fmt.Println(searchResults)
	
	if (len(searchResults) > 0) {
		return searchResults[0]["uuid"].(string)
	} else {
		return "NOTFOUND"
	}
}	

// Login to turbo
func turboLogin(turbo_instance string, turbo_user string, turbo_password string) string {

	fmt.Println("Authenticating to Turbonomic instance, "+turbo_instance) 

  	url := "https://"+ turbo_instance +"/vmturbo/rest/login"
  	method := "POST"

  	payload := &bytes.Buffer{}
  	writer := multipart.NewWriter(payload)
  	_ = writer.WriteField("username", turbo_user)
  	_ = writer.WriteField("password", turbo_password)
  	err := writer.Close()
  	if err != nil {
    	fmt.Println(err)
    	os.Exit(2)
  	}

	// set up the request client to ignore self-signed cert from Turbo
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}

  	req, err := http.NewRequest(method, url, payload)
  	if err != nil {
    	fmt.Println(err)
  	}
  	req.Header.Set("Content-Type", writer.FormDataContentType())
  	res, err := client.Do(req) // send the post request, "res" has the response
  	if err != nil {
    	fmt.Println(err)
  	}
  	defer res.Body.Close()
  	//body, err := ioutil.ReadAll(res.Body)
  	//fmt.Println(string(body))
  	
  	// get the jsessionid cookie for subsequent requests
  	// This is inelegant code at this time that relies on knowing there is one cookie, the first part of which is the jsessionID bit	
  	cookie := res.Cookies()	
  	jsessionid_cookie := cookie[0].Name + "=" + cookie[0].Value
  	
	return jsessionid_cookie
}
