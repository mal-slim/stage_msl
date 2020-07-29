// Loader Header
// @shortname 	=	stdBudgetByVersionReport  @
// @name		=	budget Report By version  @
// @dataEntity	=   budgetVersion @
// @category	=   excelRules @
// @scope		=   Root  @
// $Id$

/**
 * @fileOverview
 *
 * This rule generate an excel export of the content of a budget version
 *
 * @author MCC
 * @version $Id$
 */
/* ****************************************************************************
 * Java used Package
 * ***************************************************************************/


importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult)
importClass(Packages.java.text.SimpleDateFormat);
importPackage(Packages.java.util);
importClass(Packages.org.apache.commons.lang.StringUtils);
/* ****************************************************************************
 * Diapason library import
 * ***************************************************************************/
uselib(globalVariableLibrary);
uselib(reportParametersLibrary);
uselib(excelLibrary);
uselib(stdBudgetReportLibrary);

/**
 * @fileOverview <b> Report Header -> Lists all column fields here</b><p>
 * Remember to change along with the corresponding HQL retrieval
 */
 
 var params = reportParamInitialization(source);    
 
if (params.get("importFormat") == 'true')
		var header = ["Entity", "Currency", "Nature","Amount","Budget date","Status","External ID","Commentary","Strategy"];
else
		var header = ["Id", "Entity", "Currency", "Status", "Category", "Analytic Type","Entry Date","Amount","Commentary","Cpty","Strategy"];

header = completeHeader(header);  // complete with structure

var paramsHql = new java.util.HashMap();
var paramsHql2 = new java.util.HashMap();

[hql,budgetVersionOnParams]=getHqBudgetVersion(params);
paramsHql.put("budgetVersion",budgetVersionOnParams) ;
paramsHql.put("endDate", helper.parseDate(params.get("endDate")));
paramsHql.put("startDate",helper.parseDate(params.get("startDate"))) ;

paramsHql2.put("budgetVersion",budgetVersionOnParams) ;

var structurePathMap = new java.util.HashMap();
var structId = getStruct(paramsHql2);
var path = [];
structurePathMap.put(structId,path);
structurePathMap = structurePath(structurePathMap,structId);

var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

createHqlReport("stdBudget", hqlList, header);

function completeHeader(iHeader){
	var atColumn = []
	var budget = helper.load(Packages.com.mccsoft.diapason.data.Budget, helper.parseLong(helper.getParamValue("budget")));
	var paramsLevel = new java.util.HashMap();
	var DepthTree = getMaxLevel(paramsLevel, budget) - 1;
	for (var i = new java.lang.Long(1); i <= DepthTree; i++) {
		atColumn = atColumn.concat(["Q_BUDGET_level_" +i])	
	}
	iHeader=iHeader.concat(atColumn);
	return iHeader ;
}

function getStruct(paramsHql)
{
	var hql = "SELECT bv.budget.budgetStructure.id from BudgetVersion bv"; 
	hql+= " where bv = :budgetVersion";
	
	var hqlResult = helper.executeHqlQuery(hql, paramsHql);
	return hqlResult;
}
	
function structurePath(iStructurePathMap,parent)   
{
	//iStructurePathMap contains the id and the full path of every structure 
	//parent is the root from where starts the DepthTree
	
	var hql = "SELECT bs.id, bs.name from BudgetStructure bs";
	hql+= " where bs.parent.id = :budgetStructureId" ;
	var paramsQuery = new Packages.java.util.HashMap();
	paramsQuery.put("budgetStructureId", parent);
	var resultQuery = helper.executeHqlQuery(hql, paramsQuery);
    
	var pathParent= iStructurePathMap.get(parent); 
	if(resultQuery.size()>0){
	    for (var i=0;i<resultQuery.size();i++) {
		    var id = resultQuery.get(i)[0];
			var name =resultQuery.get(i)[1];
		    var mapLink = new java.util.HashMap();
			var path =pathParent.concat([name]);
			mapLink.put(id,path);  // intermdiate map that contains the id and path of a child structure
		    var hashmapInter= structurePath(mapLink,id);   // map with id and path of all child structures 
		    iStructurePathMap.putAll(hashmapInter);
        }
	}
	return iStructurePathMap;   	
}

function fillRows(iHeader, iHeaderMap, iData) {
	
	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	
	if(params.get("importFormat")=='true')
	{
		if(iData[0].getVersion().getNature())
			row[iHeaderMap.get("Nature")]= iData[0].getVersion().getNature().getShortname() ;
		row[iHeaderMap.get("Budget date")]= iData[0].getBudgetDate();
		row[iHeaderMap.get("External ID")]= iData[0].getExternalId();
	}
	else{
		row[iHeaderMap.get("Id")] = iData[0].getId();
		if(iData[0].getStructure())
			row[iHeaderMap.get("Category")] = iData[0].getStructure().getName();
		if(iData[0].getStructure().getAnalyticType())
			row[iHeaderMap.get("Analytic Type")] = iData[0].getStructure().getAnalyticType().getShortname();
		row[iHeaderMap.get("Entry Date")] = iData[0].getEntryDate();
		if(iData[0].getCpty())	
			row[iHeaderMap.get("Cpty")] = iData[0].getCpty().getShortname();
	}
	
	if(iData[0].getVersion().getEntity())
		row[iHeaderMap.get("Entity")] = iData[0].getVersion().getEntity().getShortname();
	if(iData[0].getVersion().getCurrency())
		row[iHeaderMap.get("Currency")] = iData[0].getVersion().getCurrency().getShortname();
	if(iData[0].getStatus())
		row[iHeaderMap.get("Status")] = iData[0].getStatus().getShortname();
	row[iHeaderMap.get("Amount")] = iData[0].getAmount() * iData[0].getStructure().getSign();
	row[iHeaderMap.get("Commentary")] = iData[0].getComment();
	
	row[iHeaderMap.get("Strategy")] = iData[0].getStrategy();
	
	levelsStructure = structurePathMap.get(iData[0].getStructure().getId()) //return the path of the cuurent structure
	var iter= 0;
	for (var i = new java.lang.Long(1); i <= levelsStructure.length; i++) {
		row[iHeaderMap.get("Q_BUDGET_level_" +i)]= levelsStructure[iter];
		iter++;
	}
	
	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}


function getHqBudgetVersion(params) {
	var hql = "from BudgetEntry bde"; 
	hql+= " where bde.version = :budgetVersion";
	hql+= " and bde.entryDate < :endDate";
	hql+= " and bde.entryDate >= :startDate";
	

	return [hql,setBudgetVersionOnParams(params)] ;
}

//retrieve the version of budget from parameters
function setBudgetVersionOnParams(params) {
	
	var paramsHql2 = new java.util.HashMap();
	if (StringUtils.isNotBlank(params.get("budgetVersionId")) == false 
		 && StringUtils.isNotBlank(params.get("budgetDate")) == true) { 
		 
		var hql = "select bde.version from BudgetEntry bde"; 
		hql += " where " + helper.buildListFilter("bde.version.entity.id", params.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", params.get("currency"));
		hql += " and bde.version.active = 1";
		hql += " and " + helper.buildListFilter("bde.version.budget.id", params.get("budget"));
		hql +=" and bde.version.validationDate = :validationDate" ;
		paramsHql2.put("validationDate",getValidationDate(params));
		var hqlResult = helper.executeHqlQuery(hql, paramsHql2);
		helper.log("INFO",hqlResult.size());
		if (hqlResult.size() > 0)
			return hqlResult.get(0);  
		else 
			helper.sendError("no validationDate superior then budgetDate ");
		
	} else if (StringUtils.isNotBlank(params.get("budgetVersionId")) == false
		 && StringUtils.isNotBlank(params.get("budgetDate")) == false) { //on prend la version current
		 
		var hql = "select bde.version from BudgetEntry bde"; 
		hql += " where " + helper.buildListFilter("bde.version.entity.id", params.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", params.get("currency"));
		hql += " and " + helper.buildListFilter("bde.version.budget.id", params.get("budget"));
		hql += "and bde.version.name = 'current'";
		var hqlResult = helper.executeHqlQuery(hql,paramsHql2);
		
		if (hqlResult.size() > 0) {
			return hqlResult.get(0);
		} else {
			helper.sendError("There is no current version.");
		}
	}
	else{
	    var hql = "select bde.version from BudgetEntry bde"; 
	   	hql += " where " + helper.buildListFilter("bde.version.id", params.get("budgetVersionId"));
	   	var hqlResult = helper.executeHqlQuery(hql,paramsHql2);
    	if (hqlResult.size() > 0) {
			return hqlResult.get(0);
    	}
     
	}
}

//from parameter budgetDate
function getValidationDate(params){	
	var paramsHql1 = new java.util.HashMap();

	var hql2 ="select max(bdgvrs.validationDate) from  BudgetVersion bdgvrs" ;
	hql2 += " where " + helper.buildListFilter("bdgvrs.entity.id", params.get("entity"));
	hql2 += " and " + helper.buildListFilter("bdgvrs.currency.id", params.get("currency"));
	hql2 += " and bdgvrs.active = 1";
	hql2 += " and " + helper.buildListFilter("bdgvrs.budget.id", params.get("budget"));
	hql2 += " and bdgvrs.validationDate !=null";
	hql2 += " and bdgvrs.validationDate >= :budgetDate"; 
	paramsHql1.put("budgetDate",helper.parseDate(params.get("budgetDate")));
	var hqlResult1 = helper.executeHqlQuery(hql2, paramsHql1);
	helper.log("INFO",hqlResult1.get(0))
	return hqlResult1.get(0);
}