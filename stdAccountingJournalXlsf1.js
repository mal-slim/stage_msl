// Loader Header
// @shortname 	=	stdAccountingJournalXls @
// @name		=	std Accounting Journal Xls @
// @dataEntity	=	accountingMovement  @
// @category	=	excelRules @
// @scope		=	Root  @
// $Id$
//

/**
 * @fileOverview
 * This rule generate an excel export of Accounting Journal Xls from an expression context.
 *
 * @author mcc
 */
 
 
 var params = reportParamInitialization(source);    
 

importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
uselib(globalVariableLibrary);
uselib(reportParametersLibrary);
uselib(excelLibrary);

var expressionContextId = helper.getTransientValue("expressionContextId");
var expressionContextTmp = null; // this value is used as a test
var expressionContextShortname = null;

if (null != expressionContextId) {
	expressionContextTmp = helper.load(com.mccsoft.diapason.data.expressionLanguage.ExpressionContext, helper.parseLong(expressionContextId));
	expressionContextShortname = expressionContextTmp.getShortname();
}
if (null != expressionContextTmp) {
	expressionContextShortname = expressionContextTmp.getShortname();
}else{
	expressionContextShortname = "stdAccountingJournalXls";
}

var header1=["amountOther","description","rate","rateOther","amountOrigin","valueDate","sign","externalReference","am_lastUpdate","am_id","amount","currencyOther","cpty",
"currencyOrigin","amlastUser","currency","ae_lastUser","applicativeStatus","processDate","exportDate","processId","lastUpdate","reference","processDate","accountingEntryId",
"accountingDate","creditAmountOri","debitAmountOri","creditAmount","debitAmount","signChar","folder","tradeId",
"extraInfo","extraInfoExample"]
	   




var header2 = getContextColumns(expressionContextShortname);
var header =  header2.concat(header1);
[hql, paramsHql] = getHqlAccountingMovement();

header = retrieveHeader(hql, paramsHql);

var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

var cash_accountingAccount = new java.util.HashMap();	//variables cash utilisés dans la fonction fillrows pour les champs recuperés de l'expression contexte avec un eval
var cash_entity= new java.util.HashMap();

createHqlReport("stdAccounting", hqlList, header);

/**
 * Function to roww
 * @param {*} iHeader
 * @param {*} iHeaderMap
 * @param {*} iData
 */

function retrieveHeader(hql, paramsHql) {
	helper.createScrollableHqlQuery(hql, paramsHql);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		fillInheader(entries, header);
	}
	helper.closeScrollableQuery();

	return header;
}

function fillInheader(iEntries, iHeader) {
	for (var iterator = iEntries.iterator(); iterator.hasNext(); ) {
		var entry = iterator.next();
		iMap = getExtra(entry);
		for (var it = iMap.keySet().iterator(); it.hasNext(); ) {
			var item = it.next();
			if (iHeader.indexOf(String(item)) == -1) {
				iHeader.push(String(item));
			}
		}
	}

}
	
function fillRows(iHeader, iHeaderMap, iData) {
	hMap = getExtra(iData);
	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	
	fillEach(iHeaderMap,iData,row);

	
    var cachedObject =  cash_accountingAccount.get("test_cash");
    if (cachedObject == null) {
        cachedObject = helper.eval(expressionContextShortname, iData[0].getAccountingAccount());
        cash_accountingAccount.put("test_cash", cachedObject);
    }
	var cachedObject1 =  cash_entity.get("test_cash");
    if (cachedObject1 == null) {
        cachedObject1 = helper.eval(expressionContextShortname, iData[0].getAccountingEntry().getEntity());
        cash_entity.put("test_cash", cachedObject1);
    }
	
	
	
	fillExpression(cachedObject,iHeaderMap,row);
	fillExpression(cachedObject1,iHeaderMap,row);


	completeRowFromMap(iHeaderMap, hMap, row);
	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}


 
 function getExtra(iData) {
	var hMap = new java.util.HashMap();
	//In case of standard extraInfo, manage to split extraInfo like standard columns
	var extra = iData[0].getExtraInfo();
	if (StringUtils.isNotBlank(extra)) {
		var split = extra.split(",");
		for (var i = 0; i < split.length; i++) {
			if (split[i] != "") {
				var split1 = split[i].split(":");
				if (split1[0] != "")
					hMap.put(split1[0], split1[1]);
			}
		}

	}
	return hMap;
}
 
 
 
function fillEach(iHeaderMap,iData,row)
{
	/*
	
	if(helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").size()!= 0)            //??????????????????????????????
		if(helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").get(1).getId())
			row[iHeaderMap.get("parentType")]="event" ;
		else
			row[iHeaderMap.get("parentType")]="cashMovement" ;
		
	if(helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").size()!= 0)     
	    row[iHeaderMap.get("parentId")]=helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").get(0).getId();

	if(helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").size()!= 0)     
	    row[iHeaderMap.get("tradeId")]=helper.getLinkedParents(iData[0].getAccountingEntry(),"accountingEntry").get(1).getId();		  //  ???????????
	*/
	
	
	
	row[iHeaderMap.get("amountOther")]=iData[0].getAmountOther();
	row[iHeaderMap.get("description")]=iData[0].getDescription();
	row[iHeaderMap.get("rate")]=iData[0].getRate();
	row[iHeaderMap.get("rateOther")]=iData[0].getRateOther();
	row[iHeaderMap.get("amountOrigin")]=iData[0].getAmountOrigin();
	row[iHeaderMap.get("valueDate")]=iData[0].getValueDate();
	row[iHeaderMap.get("sign")]=iData[0].getSign();
	row[iHeaderMap.get("externalReference")]=iData[0].getExternalReference();
	row[iHeaderMap.get("am_lastUpdate")]=iData[0].getLastUpdate();
	row[iHeaderMap.get("am_id")]=iData[0].getId();
	row[iHeaderMap.get("extraInfo")]=iData[0].getExtraInfo();
	row[iHeaderMap.get("amount")]=iData[0].getAmount();
	row[iHeaderMap.get("exportDate")]=iData[0].getAccountingEntry().getExportDate();
	row[iHeaderMap.get("processDate")]=iData[0].getAccountingEntry().getProcessDate();
	row[iHeaderMap.get("processId")]=iData[0].getAccountingEntry().getProcessId();
	row[iHeaderMap.get("lastUpdate")]=iData[0].getAccountingEntry().getLastUpdate();
	row[iHeaderMap.get("reference")]=iData[0].getAccountingEntry().getReference();
	row[iHeaderMap.get("accountingEntryId")]=iData[0].getAccountingEntry().getId();
	row[iHeaderMap.get("accountingDate")]=iData[0].getAccountingEntry().getAccountingDate();
	if(iData[0].getCurrency()!=null)
		row[iHeaderMap.get("currency")]=iData[0].getCurrency().getShortname();
	if(iData[0].getCurrencyOther()!=null)
	    row[iHeaderMap.get("currencyOther")]=iData[0].getCurrencyOther().getShortname();
	if(iData[0].getCpty()!=null)
	    row[iHeaderMap.get("cpty")]=iData[0].getCpty().getShortname();
	if(iData[0].getCurrencyOrigin()!=null)
	    row[iHeaderMap.get("currencyOrigin")]=iData[0].getCurrencyOrigin().getShortname() ;
	if(iData[0].getLastUser()!=null)
		row[iHeaderMap.get("amlastUser")]=iData[0].getLastUser().getShortname() ;
	if(iData[0].getAccountingEntry().getLastUser()!=null)
		row[iHeaderMap.get("ae_lastUser")]=iData[0].getAccountingEntry().getLastUser().getShortname();
	if(iData[0].getAccountingEntry().getApplicativeStatus()!=null)
		row[iHeaderMap.get("applicativeStatus")]=iData[0].getAccountingEntry().getApplicativeStatus().getShortname();
	if(iData[0].getFolder()!=null)
	    row[iHeaderMap.get("currencyOrigin")]=iData[0].getFolder().getShortname() ;

		

	
	
	if (iData[0].getSign()==1){
		row[iHeaderMap.get("creditAmountOri")]=iData[0].getAmountOrigin();
		row[iHeaderMap.get("debitAmountOri")]= 0 ;
		row[iHeaderMap.get("signChar")]= "Credit" ;


	}
	else{
		row[iHeaderMap.get("creditAmountOri")]= 0 ;
		row[iHeaderMap.get("debitAmountOri")]=iData[0].getAmountOrigin();		
		row[iHeaderMap.get("signChar")]="Debit";

	}
	if (iData[0].getSign()==-1)
		row[iHeaderMap.get("debitAmount")]=iData[0].getAmount();
	else 
		row[iHeaderMap.get("debitAmount")]= 0 ;
	
	if (iData[0].getSign()==1)
		row[iHeaderMap.get("creditAmount")]=iData[0].getAmount();
	else
		row[iHeaderMap.get("creditAmount")]= 0 ;

}	


function fillExpression(iMap,iHeaderMap,row)
{
	for (var iter = iMap.entrySet().iterator(); iter.hasNext(); ) {
		var es = iter.next();
		var value = es.getValue();
		row[iHeaderMap.get(es.getKey())] = value;
	}
}



function updateHeaderFromMap(iMap, oHeader) {
	for (var it = iMap.keySet().iterator(); it.hasNext(); ) {
		var item = it.next();
		if (oHeader.indexOf(String(item)) == -1) {
			oHeader.push(String(item));
		}
	}
	return headerMap(oHeader);
}

/**
 * Fill row with map information
 * @param {*} iHeaderMap
 * @param {*} iMap
 * @param {*} oRow
 */
function completeRowFromMap(iHeaderMap, iMap, oRow) {
	for (var itM = iMap.entrySet().iterator(); itM.hasNext(); ) {
		var entry = itM.next();
		oRow[iHeaderMap.get(entry.getKey())] = entry.getValue();
	}
}

/**
 * Retrieve an javascript array of expression shortnam
 * @param {*} contextName
 */
function getContextColumns(contextName) {
	var hql = "select e.shortname from ExpressionContext ex inner join ex.expressions e where ex.shortname = :contextName and ex.status = 'actual' and ex.active = 1 order by e.shortname";
	var par = new java.util.HashMap();
	par.put("contextName", contextName);
	result = helper.executeHqlQuery(hql, par, -1);
	array = []
	for (var i = 0; i < result.size(); i++) {
		array.push(String(result.get(i)));
	}
	return array;
}
/**
 * This function accounting movement according to search criteria
 *
 * @return hql and params
 */
function getHqlAccountingMovement() {
	var scopeId = (params.get("scope") != null) ? params.get("scope") : params.get("_scopeId");
	var hql = "	from AccountingMovement accMvt ";
	hql += "where" + helper.createFilter(scopeId, DiapasonFilter.CHILDREN, "accMvt.accountingEntry.entity", "internalScope", DiapasonFilter.INTERNAL_ENTITY);
	var paramsHql = new java.util.HashMap();
	
	if (params.get("accountingDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.accountingDate >= :accountingDateFrom";
		paramsHql.put("accountingDateFrom", helper.parseDate(params.get("accountingDateFrom")));
	}
	if (params.get("accountingDateTo") != null) {

		hql += " and  accMvt.accountingEntry.accountingDate <= :accountingDateTo)";
		paramsHql.put("accountingDateTo", helper.parseDate(params.get("accountingDateTo")));
	}
	if (params.get("lastUpdateFrom") != null) {
		hql += " and  accMvt.lastUpdate >= :lastUpdateFrom";
		paramsHql.put("lastUpdateFrom", helper.parseDate(params.get("lastUpdateFrom")));
	}
	if (params.get("lastUpdateTo") != null) {
		hql += " and  accMvt.lastUpdate <= :lastUpdateTo";
		paramsHql.put("lastUpdateTo", helper.parseDate(params.get("lastUpdateTo")));
	}
	if (params.get("processDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.processDate >= :processDateFrom";
		paramsHql.put("processDateFrom", helper.parseDate(params.get("processDateFrom")));
	}
	if (params.get("processDateTo") != null) {
		hql += " and  accMvt.accountingEntry.processDate <= :processDateTo";
		paramsHql.put("processDateTo", helper.parseDate(params.get("processDateTo")));
	}
	if (params.get("exportDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.exportDate >= :exportDateFrom";
		paramsHql.put("exportDateFrom", helper.parseDate(params.get("exportDateFrom")));
	}
	if (params.get("exportDateTo") != null) {
		hql += " and  accMvt.accountingEntry.exportDate <= :exportDateTo";
		paramsHql.put("exportDateTo", helper.parseDate(params.get("exportDateTo")));
	}

	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", params.get("entity"));
	hql += " and " + helper.buildListFilter("accMvt.folder.id", params.get("folder"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", params.get("cpty"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", params.get("accountingCurrency"));
	hql += " and " + helper.buildListFilter("accMvt.currencyOrigin.id", params.get("currencyOrigin"));
	hql += " and " + helper.buildListFilter("accMvt.accountingAccount.id", params.get("accountingaccount"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus.id", params.get("applicativeStatus"));

	if (params.get("accountingEntryIdFrom") != null) {
		hql += " and  accMvt.accountingEntry.id >= :accountingEntryIdFrom";
		paramsHql.put("accountingEntryIdFrom", params.get(helper.getParamValue("accountingEntryIdFrom")));
	}
	if (params.get("accountingEntryIdTo") != null) {
		hql += " and  accMvt.accountingEntry.id <= :accountingEntryIdTo";
		paramsHql.put("accountingEntryIdTo",params.get(helper.getParamValue("accountingEntryIdTo")));
	}
	if (params.get("amountFrom") != null) {
		hql += " and  accMvt.amount >= :amountFrom";
		paramsHql.put("amountFrom", helper.parseLong(params.get("amountFrom")));
	}
	if (params.get("amountTo") != null) {
		hql += " and  accMvt.amount <= :amountTo";
		paramsHql.put("amountTo", helper.parseLong(params.get("amountTo")));
	}
	if (params.get("description") != null) {
		hql += " and  accMvt.description like :description";
		paramsHql.put("description", params.get("description"));
	}

	if (StringUtils.isNotBlank(params.get("tradeId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM EventLink el where el.dataEntity.shortname = 'accountingEntry' \
		and el.dataEntityId=accMvt.accountingEntry.id \
		and el.event.trade.id = " + params.get("tradeId") + ")";
	}

	if (StringUtils.isNotBlank(helper.params.get("eventId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM EventLink el where el.dataEntity.shortname = 'accountingEntry' \
		and el.dataEntityId=accMvt.accountingEntry.id \
		and el.event.id = " + params.get("eventId") + ")";
	}
	if (StringUtils.isNotBlank(params.get("movementId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM CashMovementLink cshMvtLnk where cshMvtLnk.dataEntity.shortname = 'accountingEntry' \
		and cshMvtLnk.dataEntityId = accMvt.accountingEntry.id \
		and cshMvtLnk.cashMovement.id = " + params.get("movementId") + ")";
	}
	if (StringUtils.isNotBlank(params.get("processId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM ProcessLink prcLnk where prcLnk.dataEntity.shortname = 'accountingEntry' \
		and prcLnk.dataEntityId=accMvt.accountingEntry.id \
		and prcLnk.process.id = " + params.get("processId") + ")";
	}
	if (params.get("onlyIsolatedAccountingEntry") == "true") {
		hql += " AND NOT EXISTS(SELECT 1 FROM ProcessLink prcLnk where prcLnk.dataEntity.shortname = 'accountingEntry' \
				and prcLnk.dataEntityId=accMvt.accountingEntry.id )";  //mettre a la fin

    }
	hql += " order by accMvt.accountingEntry.id asc ";
	return [hql, paramsHql];
}


