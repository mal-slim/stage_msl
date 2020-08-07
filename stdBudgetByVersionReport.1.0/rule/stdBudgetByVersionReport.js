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


importPackage(Packages.java.util);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult)
importClass(Packages.java.text.SimpleDateFormat);
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

// Format use in order to reimport this budget
if (params.get("importFormat") == 'true')
	var header = ["Entity", "Currency", "Nature", "Amount", "Budget date", "Status", "External ID", "Commentary", "Strategy"];
else
	var header = ["Id", "Entity", "Currency", "Status", "Category", "Analytic Type", "Entry Date", "Amount", "Commentary", "Cpty", "Strategy"];

controlParams(params);
// Find the budget version related with parameters
var budgetVersion = getBudgetVersion(params);
header = completeHeader(header,params,budgetVersion); // complete with structure

// Get the budget structure of the budget version
var structId = budgetVersion.getBudget().getBudgetStructure().getId();
var structurePathMap = new java.util.HashMap();
var path = [];
structurePathMap.put(structId, path);
structurePathMap = structurePath(structurePathMap, structId);

var hql = "from BudgetEntry bde  where bde.version.id = :budgetVersion ";
var paramsHql = new java.util.HashMap();
paramsHql.put("budgetVersion", budgetVersion.getId());
if (StringUtils.isNotBlank(params.get("startDate"))) {
	hql += " and bde.entryDate >= :startDate ";
	paramsHql.put("startDate", helper.parseDate(params.get("startDate")));
}
if (StringUtils.isNotBlank(params.get("endDate"))) {
	hql += " and bde.entryDate <= :endDate ";
	paramsHql.put("endDate", helper.parseDate(params.get("endDate")));
}
var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

createHqlReport("stdBudget", hqlList, header);

function completeHeader(iHeader,iParams,iBudgetVersion) {
	var atColumn = []
	
	var budget = iBudgetVersion.getBudget() ;
	

	var paramsLevel = new java.util.HashMap();
	var DepthTree = getMaxLevel(paramsLevel, budget) - 1;
	for (var i = new java.lang.Long(1); i <= DepthTree; i++) {
		atColumn = atColumn.concat(["Q_BUDGET_level_" + i])
	}
	iHeader = iHeader.concat(atColumn);
	return iHeader;
}



function structurePath(iStructurePathMap, parent) {
	//iStructurePathMap contains the id and the full path of every structure 
	//parent is the root from where starts the DepthTree

	var hql = "SELECT bs.id, bs.name from BudgetStructure bs";
	hql += " where bs.parent.id = :budgetStructureId";
	var paramsQuery = new Packages.java.util.HashMap();
	paramsQuery.put("budgetStructureId", parent);
	var resultQuery = helper.executeHqlQuery(hql, paramsQuery);

	var pathParent = iStructurePathMap.get(parent);
	if (resultQuery.size() > 0) {
		for (var i = 0; i < resultQuery.size(); i++) {
			var id = resultQuery.get(i)[0];
			var name = resultQuery.get(i)[1];
			var mapLink = new java.util.HashMap();
			var path = pathParent.concat([name]);
			mapLink.put(id, path); // intermdiate map that contains the id and path of a child structure
			var hashmapInter = structurePath(mapLink, id); // map with id and path of all child structures 
			iStructurePathMap.putAll(hashmapInter);
		}
	}
	return iStructurePathMap;
}

function fillRows(iHeader, iHeaderMap, iData) {
	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	var budgetEntry = iData[0];
	if (params.get("importFormat") == 'true') {
	    if (budgetEntry.getVersion().getNature())
		    row[iHeaderMap.get("Nature")] = budgetEntry.getVersion().getNature().getShortname();
		row[iHeaderMap.get("Budget date")] = budgetEntry.getBudgetDate();
		row[iHeaderMap.get("External ID")] = budgetEntry.getExternalId();
	} else {
		row[iHeaderMap.get("Id")] = budgetEntry.getId();
		if (budgetEntry.getStructure())
			row[iHeaderMap.get("Category")] = budgetEntry.getStructure().getName();
		if (budgetEntry.getStructure().getAnalyticType())
			row[iHeaderMap.get("Analytic Type")] = budgetEntry.getStructure().getAnalyticType().getShortname();
		row[iHeaderMap.get("Entry Date")] = budgetEntry.getEntryDate();
		if (budgetEntry.getCpty())
			row[iHeaderMap.get("Cpty")] = budgetEntry.getCpty().getShortname();
		levelsStructure = structurePathMap.get(budgetEntry.getStructure().getId()); //return the path of the current structure
		var iter = 0;
		for (var i = new java.lang.Long(1); i <= levelsStructure.length; i++) {
			row[iHeaderMap.get("Q_BUDGET_level_" + i)] = levelsStructure[iter];
			iter++;
		}
	}

	if (budgetEntry.getVersion().getEntity())
		row[iHeaderMap.get("Entity")] = budgetEntry.getVersion().getEntity().getShortname();
	if (budgetEntry.getVersion().getCurrency())
		row[iHeaderMap.get("Currency")] = budgetEntry.getVersion().getCurrency().getShortname();
	if (budgetEntry.getStatus())
		row[iHeaderMap.get("Status")] = budgetEntry.getStatus().getShortname();
	row[iHeaderMap.get("Amount")] = budgetEntry.getAmount() * budgetEntry.getStructure().getSign();
	row[iHeaderMap.get("Commentary")] = budgetEntry.getComment();

	row[iHeaderMap.get("Strategy")] = budgetEntry.getStrategy();

	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}

/**
 * Budget version could be retrieve by 3 methods
 * by the validation date
 * by current version
 * by version selected
 * @param {*} iParams 
 */
function getBudgetVersion(iParams) {
	if (StringUtils.isNotBlank(iParams.get("budgetVersionId")) == false &&
		StringUtils.isNotBlank(iParams.get("budgetDate")) == true) {
		var hql = "select bde.version from BudgetEntry bde";
		hql += " where " + helper.buildListFilter("bde.version.entity.id", iParams.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", iParams.get("currency"));
		hql += " and " + helper.buildListFilter("bde.version.budget.id", iParams.get("budget"));
		hql += " and bde.version.active = 1";
		hql += " and bde.version.validationDate = :validationDate";
		var paramsHql = new java.util.HashMap();
		paramsHql.put("validationDate", getValidationDate(iParams));
		var hqlResult = helper.executeHqlQuery(hql,paramsHql);
		helper.log("INFO",hqlResult);
		helper.log("INFO",hqlResult.get(0))
		if (hqlResult.size() > 0)
			return hqlResult.get(0);
		
	} else if (StringUtils.isNotBlank(iParams.get("budgetVersionId")) == false &&
		StringUtils.isNotBlank(iParams.get("budgetDate")) == false) { //on prend la version current
		var hql = "select bde.version from BudgetEntry bde";
		hql += " where " + helper.buildListFilter("bde.version.entity.id", iParams.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", iParams.get("currency"));
		hql += " and " + helper.buildListFilter("bde.version.budget.id", iParams.get("budget"));
		hql += "and bde.version.name = 'current'";
		var hqlResult = helper.executeHqlQuery(hql, null);
		if (hqlResult.size() == 1) {
			return hqlResult.get(0);
		} else if (hqlResult.size() > 1) {
			helper.setError("BUDGETVERSIONCONTROL");
		} else {
			helper.setError("BUDGETVERSIONCONTROL2");
		}
	} else {
	    var hql = "select bde.version from BudgetEntry bde where bde.version.id = :budgetVersionId";
	    var paramsHql = new java.util.HashMap(); 
		paramsHql.put("budgetVersionId",helper.parseLong(iParams.get("budgetVersionId")));
		return helper.executeHqlQuery(hql,paramsHql).get(0) ;
	}
}

/**
 * Function to retrive the max validation date related with the budget date selected
 * @param {*} iParams 
 */
function getValidationDate(iParams) {
	var paramsHql2 = new java.util.HashMap();
	var hql2 = "select max(bdgvrs.validationDate) from BudgetVersion bdgvrs";
	hql2 += " where " + helper.buildListFilter("bdgvrs.entity.id", iParams.get("entity"));
	hql2 += " and " + helper.buildListFilter("bdgvrs.currency.id", iParams.get("currency"));
	hql2 += " and " + helper.buildListFilter("bdgvrs.budget.id", iParams.get("budget"));
	hql2 += " and bdgvrs.active = 1";
	hql2 += " and bdgvrs.validationDate <= :budgetDate";
	hql2 += " and bdgvrs.validationDate !=null";
	paramsHql2.put("budgetDate", helper.parseDate(iParams.get("budgetDate")));
	var hqlResult2 = helper.executeHqlQuery(hql2, paramsHql2);
	if (hqlResult2.size() == 0) {
		// No budget validate before the budget date
		helper.setError("BUDGETDATECONTROL");
	}
	else
		helper.log("INFO",hqlResult2);
		helper.log("INFO",hqlResult2.get(0));
		return hqlResult2.get(0);
}

/**
 * TODO
 * @param {*} iParams 
 */
function controlParams(iParams){
	if(params.get("budgetVersionId")==null){
		if(params.get("budget")==null || params.get("entity")==null || params.get("currency")==null)
			helper.setError("BUDGETCHOICECONTROL");
	}
	else{
		if(params.get("budget") || params.get("entity") || params.get("currency"))
			helper.setError("BUDGETCHOICE2CONTROL")
	}
}
