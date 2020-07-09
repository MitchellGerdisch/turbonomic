package main

/*
.SYNOPSIS 

.DESCRIPTION
Pushes records to Power BI streaming dataset that provide host-level actions for clusters in a named Turbo cluster group.
Requires a Power BI streaming dataset defined with the following fields:
- Timestamp (DateTime)
- Cluster_Name (Text)
- Entity_Name (Text) (e.g. host name)
- Entity_Type (Text) (e.g. PhysicalMachine, VirtualMachine)
- Action_Type (Text) (e.g. Provision, Suspend, Move)
- Action_Details (Text)
- Reason (Text)
- Severity (Text)
- Category (Text)

.EXAMPLE
push_turbo-cluster-host_actions -turbo_instance turbonomic.mycompany.com -turbo_user USERNAME - turbo_password PASSWORD -cluster_group CLUSTER_GROUP_NAME -powerbi_stream_url POWERBI_DATASET_URL -csv_file APPSERVER.csv
For the servers associated with each applicatin found in the provided CSV, this script will push a separate row of data to the given Power BI stream 
where each row provides the application, the server and action data.

.PARAMETER turbo_instance
Specify the Turbonomic server hostname, FQDN, or IP address where you are adding the targets.

.PARAMETER turbo_user
Specify the username for accessing Turbo. 

.PARAMETER turbo_password
Specify the password for accessing Turbo. 

.PARAMETER cluster_group
Specify the name of the cluster group defined in Turbo for which to get the host actions.

.PARAMETER powerbi_stream_url
Currently, this is the URL with the key that one gets when creating a Streaming DataSet set in PowerBI.
(Eventually, this may be replaced with a PowerBI API credentials as configured via registering an app from dev.powerbi.com or a service prinicipal creds.)

CROSS-COMPLIATION NOTES
env GOOS=windows GOARCH=amd64 go build ./push_turbo_cluster_actions.go

*/

import (
    "bytes"
  	"mime/multipart"
 	"encoding/json"
 	"strings"
    "fmt"
    "io/ioutil"
	"net/http"
    // used if debugging http "net/http/httputil"
    "crypto/tls"
    "flag"
    "os"
    "time"
    //"reflect"
)

type Action struct {
	actionUuid string
	actionDetails string
	actionType string
	entityType string
	entityName string
	actionFrom string
	actionTo string
	reason string
	severity string
	category string
}

func main() {

	// 0.1 Version: Initial version
	version := "0.1"
	fmt.Println("push_turbo-cluster-host_actions version "+version)

	// Process command line arguments
	turbo_user := flag.String("turbo_user", "", "Turbo Username")
	turbo_password:= flag.String("turbo_password", "", "Turbo Password")
	turbo_instance := flag.String("turbo_instance", "", "Turbo IP or FQDN")
	cluster_group := flag.String("cluster_group", "", "Turbo Cluster Group Name")
	powerbi_stream_url := flag.String("powerbi_stream_url", "", "URL for the PowerBI Stream Dataset")

	flag.Parse()
	
	if ((*turbo_user == "") || (*turbo_password == "") || (*turbo_instance == "") || (*cluster_group == "") || (*powerbi_stream_url == "")) {
		fmt.Println("*************")
		fmt.Println("Missing command line argument ...")
		fmt.Println("Run \""+os.Args[0]+" -h\" for more information.")
		fmt.Println("*************")
		
		fmt.Println("\n")
		fmt.Println("The PowerBI Streaming Dataset you are using must have the following fields set up with the types given in parentheses:")
		fmt.Println()
		fmt.Println("- Timestamp (DateTime)")
		fmt.Println("- Cluster_Name (Text)")
		fmt.Println("- Entity_Name (Text) (e.g. host name)")
		fmt.Println("- Entity_Type (Text) (e.g. PhysicalMachine, VirtualMachine)")
		fmt.Println("- Action_Type (Text) (e.g. Provision, Suspend, Move)")
		fmt.Println("- Action_Details (Text)")
		fmt.Println("- Reason (Text)")
		fmt.Println("- Severity (Text)")
		fmt.Println("- Category (Text)")

		os.Exit(1)
	}
	// end command line arguments
	
	time_start := time.Now()
	
	// Call Turbo to get any host-level actions for the servers assigned to each application
	fmt.Printf("*** Getting host actions from Turbo for clusters in group, %s ...\n",*cluster_group)
	clusterActionsMap, clusterNameMap := getHostActions(*turbo_instance, *turbo_user, *turbo_password, *cluster_group) 

	time_now := time.Now()
	time_elapsed := int(time_now.Sub(time_start).Seconds())
	fmt.Printf("took %d seconds.\n\n", time_elapsed)
	time_start = time_now

	// Call PowerBI API to push data to the stream dataset
	fmt.Println("*** Sending records to PowerBI ...")
	pushPowerBiData(clusterNameMap, clusterActionsMap, *powerbi_stream_url)

	time_now = time.Now()
	time_elapsed = int(time_now.Sub(time_start).Seconds())
	fmt.Printf("took %d seconds.\n\n", time_elapsed)
	time_start = time_now
	
	fmt.Println("Done.")
}


// Using the data found in the various maps, assemble API calls to push PowerBi to push the data stream
func pushPowerBiData(clusterNameMap map[string]string, clusterActionsMap map[string][]Action, powerbi_url string) {

	t := time.Now()
	timeString := t.Format(time.RFC3339)
  	method := "POST"
	
	for clusterUuid,clusterName := range clusterNameMap {
		var payload string
		action_count := 0
		for _,action := range clusterActionsMap[clusterUuid] {
			timestamp_part := "\"Timestamp\": \""+timeString+"\""
			clustername_part := "\"Cluster_Name\": \""+clusterName+"\""
			entityname_part := "\"Entity_Name\": \""+action.entityName+"\""
			entitytype_part := "\"Entity_Type\": \""+action.entityType+"\""
			actiontype_part := "\"Action_Type\": \""+action.actionType+"\""
			actiondetails_part := "\"Action_Details\": \""+action.actionDetails+"\""
			//actionfrom_part := "\"Action_From\": \""+action.actionFrom+"\""
			//actionto_part := "\"Action_To\": \""+action.actionTo+"\""
			reason_part := "\"Reason\": \""+action.reason+"\""
			severity_part := "\"Severity\": \""+action.severity+"\""
			category_part := "\"Category\": \""+action.category+"\""
				
			//action_payload := "{"+timestamp_part+","+clustername_part+","+entityname_part+","+entitytype_part+","+actiondetails_part+","+actiontype_part+","+actionfrom_part+","+actionto_part+","+reason_part+","+severity_part+","+category_part+"}"
			action_payload := "{"+timestamp_part+","+clustername_part+","+entityname_part+","+entitytype_part+","+actiondetails_part+","+actiontype_part+","+reason_part+","+severity_part+","+category_part+"}"
			action_count++ 
			if (payload == "") {
				payload =  "[" + action_payload
			} else {
				payload = payload + "," + action_payload
			}
	  	}
	  	payload = payload + "]"
		client := &http.Client {}
		req, err := http.NewRequest(method, powerbi_url, strings.NewReader(payload))
		if err != nil {
			fmt.Println(err)
		}
		req.Header.Add("Content-Type", "application/json")
		
// 		// For debugging HTTP Call
// 		requestDump, err := httputil.DumpRequest(req, true)
// 		if err != nil {
// 				fmt.Println(err)
// 		}
// 		fmt.Println(string(requestDump))
	
		res, _:= client.Do(req)
		defer res.Body.Close()
		
		fmt.Printf("... sent %d records(s) for cluster %s\n", action_count, clusterName)
	}
}

// Calls Turbo Actions API to get all resize actions currently identified by Turbo.
// Returns:
// - map: Cluster UUID -> Cluster Name
// - map: Cluster UUID -> actions
func getHostActions (turbo_instance string, turbo_user string, turbo_password string, cluster_group_name string) (map[string][]Action, map[string]string) {

	// get auth token
	auth := turboLogin(turbo_instance, turbo_user, turbo_password) 
	
	fmt.Printf("... getting cluster list for group, %s ...\n", cluster_group_name)
	// Find the UUID for the group
	group_uuid := getGroupId(turbo_instance, cluster_group_name, auth)
	// Use the Group UUID to get the cluster members of the group
	clusterNameMap := getGroupMembers(turbo_instance, auth, group_uuid)
	
	// Get the host actions for each cluster and build a map of cluster UUID to actions
	var clusterActionsMap map[string][]Action
	clusterActionsMap = make(map[string][]Action)
	for clusterUuid,clusterName := range clusterNameMap {
		fmt.Printf("... getting actions for cluster, %s ...\n", clusterName)

		base_url := "https://"+turbo_instance+"/vmturbo/rest/groups/"+clusterUuid+"/actions"
		url := base_url
		method := "GET"
		
		done := false
		for (!done) {
		
			customTransport := http.DefaultTransport.(*http.Transport).Clone()
			customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
			client := &http.Client{Transport: customTransport}	
			req, err := http.NewRequest(method, url, nil)
			if err != nil {
				fmt.Println(err)
			}
			req.Header.Add("Content-Type", "application/json")
			req.Header.Add("Cookie", auth)
			
// 			// For debugging HTTP Call
// 			requestDump, err := httputil.DumpRequest(req, true)
// 			if err != nil {
//   				fmt.Println(err)
// 			}
// 			fmt.Println(string(requestDump))
		
			res, err := client.Do(req)
			if err != nil {
    			fmt.Println(err)
    			os.Exit(3)
  			}

			defer res.Body.Close()
			// essentially creates a stringified version of the body's json
			body, _ := ioutil.ReadAll(res.Body)
			
			// Since the results is an array of json,
			// Create an array of one of these interface things to unmarshal the stringified json into
			var responseActions []map[string]interface{}
			err = json.Unmarshal([]byte(body), &responseActions)
	
 			if err != nil {
 				fmt.Println(err)
   				fmt.Printf("#### ERROR decoding response: %v\n", err)
    			if e, ok := err.(*json.SyntaxError); ok {
        			fmt.Printf("#### ERROR syntax error at byte offset %d\n", e.Offset)
    			}
    			fmt.Printf("#### ERROR response: %q\n", body)
 			}
			
			
			var allActions []Action
			for _, responseAction := range responseActions {
				var action Action
			
				action.actionUuid = responseAction["uuid"].(string)
				action.actionType = responseAction["actionType"].(string)
				action.reason = responseAction["risk"].(map[string]interface{})["description"].(string)
				action.severity = responseAction["risk"].(map[string]interface{})["severity"].(string)
				action.category = responseAction["risk"].(map[string]interface{})["subCategory"].(string)
				action.actionDetails = responseAction["details"].(string)
				action.entityType = responseAction["target"].(map[string]interface{})["className"].(string)
				action.entityName = responseAction["target"].(map[string]interface{})["displayName"].(string)
	
				allActions = append(clusterActionsMap[clusterUuid], action)
				clusterActionsMap[clusterUuid] = allActions
			}

			// Are there more actions to get from the API?
			cursor := res.Header.Get("x-next-cursor")
			if (len(cursor) > 0) {
				url = base_url + "?cursor="+cursor
				fmt.Printf("... still getting actions for cluster %s (cursor=%s) ...\n",clusterName, cursor)
			} else {
				done = true
				//fmt.Println("DONE GETTING ACTIONS")
			}
		}
	}
	
	return clusterActionsMap, clusterNameMap
}

// Get Group Members
func getGroupMembers(turbo_instance string, auth string, group_uuid string) map[string]string {
	
	var clusterNameMap map[string]string
	clusterNameMap = make(map[string]string)


	url := "https://"+ turbo_instance +"/vmturbo/rest/groups/"+group_uuid+"/members"
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
	
	// Since the results is an array of json,
	// Create an array of one of these interface things to unmarshal the stringified json into
	var jsonBody []map[string]interface{}
	err = json.Unmarshal([]byte(body), &jsonBody)
	
 	if err != nil {
 		fmt.Println(err)
   		fmt.Printf("#### ERROR decoding response: %v\n", err)
    	if e, ok := err.(*json.SyntaxError); ok {
       		fmt.Printf("#### ERROR syntax error at byte offset %d\n", e.Offset)
    	}
    	fmt.Printf("#### ERROR response: %q\n", body)
 	}
 	
 	for _, groupMember := range jsonBody {
 		clusterUuid := groupMember["uuid"].(string)
 		clusterNameMap[clusterUuid] = groupMember["displayName"].(string)
 	}
 	
 	return clusterNameMap
 }

// get Group UUID
func getGroupId(turbo_instance string, cluster_group_name string, auth string) string {

	url := "https://"+ turbo_instance +"/vmturbo/rest/search?q="
	method := "POST"
	
	// VM search payload
	payload := strings.NewReader("{\n  \"className\": \"Group\",\n  \"criteriaList\": [\n    {\n      \"expVal\": \"^"+cluster_group_name+"$\",\n      \"caseSensitive\": \"false\",\n      \"filterType\": \"groupsByName\",\n      \"expType\": \"RXEQ\"\n    }\n  ],\n  \"logicalOperator\": \"AND\"\n}")
	
	customTransport := http.DefaultTransport.(*http.Transport).Clone()
	customTransport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	client := &http.Client{Transport: customTransport}	

	// create and make the request
	req, err := http.NewRequest(method, url, payload)
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

	fmt.Println("... authenticating to Turbonomic instance, "+turbo_instance) 

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
