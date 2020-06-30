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



var budget = helper.load(Packages.com.mccsoft.diapason.data.Budget, helper.parseLong(helper.getParamValue("budget")));

var DepthTree = getMaxLevel(params, budget) - 1;
var budgetLevel = getTypeLevel(DepthTree, "Q_BUDGET");
var atColumn = getColumnLevel(budgetLevel);



var header = ["Id", "Entity", "Currency", "Status", "Category", "Analytic Type","Entry Date","Amount","Commentary","Cpty","Strategy"];
header=header.concat(atColumn);



[hql,paramsHql]=getHqBudgetVersion(params);

structId = getStruct(paramsHql);
[linkedParent,linkedName]= budgetStructMap();


var path = [] ;
var hashmap = new java.util.HashMap();
hashmap = recursiv(hashmap,linkedParent,structId,linkedName);



// This array must have same value than query alias. It will order result

var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

createHqlReport("stdBudget", hqlList, header);


function getStruct(paramsHql)
{
	var hql = "SELECT bv.budget.budgetStructure.id from BudgetVersion bv"; 
	hql+= " where bv.id = :budgetVersionId";
	var hqlResult = helper.executeHqlQuery(hql, paramsHql);
	return hqlResult.get(0);
}
	

function budgetStructMap(){
	var linkedParent = new java.util.HashMap();
	var linkedName = new java.util.HashMap();
	var hql1 = " SELECT bs.id , bs.parent, bs.nodeIndex, bs.name From BudgetStructure bs"
	var hqlResult = helper.executeHqlQuery(hql1, null);
	helper.log("INFO",hqlResult.get(2)[0]);
	for (var iterator = hqlResult.iterator(); iterator.hasNext();) {
		var iter = iterator.next();
		linkedParent.put(iter[0],iter[1]);
		linkedName.put(iter[0],iter[3]);
	}
	return [linkedParent,linkedName];
}

function recursiv(hashmap,linkParent,parent,linkName)
{
	for (var it = linkParent.keySet().iterator(); it.hasNext();) {
		var item = it.next();
		if(linkParent.get(item)= parent){
			var mapLink = new java.util.HashMap();

			hashmap.putAll(recursiv(map_link.put(item,hashmap.get(item).add(linkName.get(item))),linkParent.remove(item),item,linkName));
		}		
	}
	return hashmap ;
}

function fillRows(iHeader, iHeaderMap, iData) {
	


	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);

	
	row[iHeaderMap.get("Id")] = iData[0].getId();
	if(iData[0].getVersion().getEntity())
		row[iHeaderMap.get("Entity")] = iData[0].getVersion().getEntity().getShortname();
	if(iData[0].getVersion().getCurrency())
		row[iHeaderMap.get("Currency")] = iData[0].getVersion().getCurrency().getShortname();
	if(iData[0].getStatus())
		row[iHeaderMap.get("Status")] = iData[0].getStatus().getShortname();
	if(iData[0].getStructure())
		row[iHeaderMap.get("Category")] = iData[0].getStructure().getName();
	if(iData[0].getStructure().getAnalyticType())
		row[iHeaderMap.get("Analytic Type")] = iData[0].getStructure().getAnalyticType().getShortname();
	
	row[iHeaderMap.get("Entry Date")] = iData[0].getEntryDate();
	row[iHeaderMap.get("Amount")] = iData[0].getAmount() * iData[0].getStructure().getSign();
	row[iHeaderMap.get("Commentary")] = iData[0].getComment();
	if(iData[0].getCpty())	
		row[iHeaderMap.get("Cpty")] = iData[0].getCpty().getShortname();
	row[iHeaderMap.get("Strategy")] = iData[0].getStrategy();



	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}



function getHqBudgetVersion(params) {
	var paramsHql = new java.util.HashMap();
	var hql = "from BudgetEntry bde"; 
	/*
	hql += " where " + helper.buildListFilter("bde.version.entity.id", params.get("entity"));
	hql += " and " + helper.buildListFilter("bde.version.currency.id", params.get("currency"));
	hql += " and bde.version.active = 1";
	hql += " and " + helper.buildListFilter("bde.version.budget.id", params.get("budget"));
	*/
	hql+= " where bde.version.id = :budgetVersionId";
	
	paramsHql =setBudgetVersionOnParams(params,paramsHql) ;

	return [hql,paramsHql] ;
}


	
//faire un return 

function setBudgetVersionOnParams(params,paramsHql) {
	

	var paramsHql2 = new java.util.HashMap();
	

	if (StringUtils.isNotBlank(params.get("budgetVersionId")) == false 
		 && StringUtils.isNotBlank(params.get("budgetDate")) == true) { 
		 
		var hql = "select bde.version.id from BudgetEntry bde"; 
		hql += " where " + helper.buildListFilter("bde.version.entity.id", params.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", params.get("currency"));
		hql += " and bde.version.active = 1";
		hql += " and " + helper.buildListFilter("bde.version.budget.id", params.get("budget"));
		hql += "and bde.version.validationDate !=null";
		hql +="and bde.validationDate = :validationdate" ;
		paramsHql2.put("validationdate",getValidationDate(params));
		var hqlResult = helper.executeHqlQuery(hql, paramsHql2);
		if (hqlResult.size() > 0)
			paramsHql.put("budgetVersionId", hqlResult.get(0));  //==1 sinon message erreur
		
	} else if (StringUtils.isNotBlank(params.get("budgetVersionId")) == false
		 && StringUtils.isNotBlank(params.get("budgetDate")) == false) { //on prend la version current
		 
		var hql = "select bde.version.id from BudgetEntry bde"; 
		hql += " where " + helper.buildListFilter("bde.version.entity.id", params.get("entity"));
		hql += " and " + helper.buildListFilter("bde.version.currency.id", params.get("currency"));
		hql += " and " + helper.buildListFilter("bde.version.budget.id", params.get("budget"));
		hql += "and bde.version.name = 'current'";
		var hqlResult = helper.executeHqlQuery(hql,paramsHql2);
		
		if (hqlResult.size() > 0) {
			paramsHql.put("budgetVersionId", hqlResult.get(0));
		} else {
			helper.sendError("There is no current version.");
		}
	}
	else
		paramsHql.put("budgetVersionId", params.get("budgetVersionId"));
	
	return paramsHql ;
}

function getValidationDate(params){	
	var paramsHql1 = new java.util.HashMap();

	var hql2 ="select max(bdgvrs.validationDate) from  BudgetVersion bdgvrs" ;
	hql2 += " where " + helper.buildListFilter("bdgvrs.entity.id", params.get("entity"));
	hql2 += " and " + helper.buildListFilter("bdgvrs.currency.id", params.get("currency"));
	hql2 += " and bdgvrs.active = 1";
	hql2 += " and " + helper.buildListFilter("bdgvrs.budget.id", params.get("budget"));
	hql2 += "and bde.version.validationDate !=null";
			
	hql2 += "and bdgvrs.validationDate >= :budgetDate"; 
	paramsHql1.put("budgetDate",helper.parseLong(params.get("budgetDate")));
	var hqlResult1 = helper.executeHqlQuery(hql2, paramsHql);
	/*if (hqlResult1.size() > 0)    si non on retourne quoi */
		
	return hqlResult1.get(0);
}





