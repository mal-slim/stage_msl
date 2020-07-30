importClass(Packages.com.mccsoft.diapason.util.DateUtil);
importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
var expressionContextTmp = null;
importClass(Packages.org.apache.commons.lang.StringUtils);
uselib(globalVariableLibrary);
uselib(excelLibrary);

var params = reportParamInitialization(source);

var expressionContextId = helper.getTransientValue("expressionContextId");
var expressionContextShortname = null;

if (null != expressionContextId) {
	expressionContextTmp = helper.load(com.mccsoft.diapason.data.expressionLanguage.ExpressionContext, helper.parseLong(expressionContextId));
	expressionContextShortname = expressionContextTmp.getShortname();
}
if (null != expressionContextTmp) {
	expressionContextShortname = expressionContextTmp.getShortname();
} else {
	expressionContextShortname = "stdAccountingAccountState";
}

var header = ["cpty", "folder", "currency", "origincurrency", "accountingMouvementId", "accountingEntryId", "accountingDate", "valueDate",
	"accountingRate", "description", "excelIndex", "rowDescription", "AccEntryInternalStatus",
	"originOpeningBalance", "originDebitMovement", "originCreditMovement", "originClosingBalance","openingBalance", "debitMovement", "creditMovement", "closingBalance"];

var header = header.concat(getContextColumns(expressionContextShortname));

[hql, paramsHql] = getOpeningBalance(params);
[hql1, paramsHql1] = getClosingBalance(params);
[hql2, paramsHql2] = getAccountingMovement(params);

var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

hqlList.push({
	hql: [hql1],
	hqlParams: paramsHql1,
	rowsFunction: fillRows1
});


hqlList.push({
	hql: [hql2],
	hqlParams: paramsHql2,
	rowsFunction: fillRows2
});

var cashAccountingAccount = new java.util.HashMap();
var cashEntity = new java.util.HashMap();

createHqlReport("stdAccountingAccountState", hqlList, header);

function fillRows(iHeader, iHeaderMap, iData) {

	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	var paramsHql = new java.util.HashMap();
	var hql2 = "from AccountingAccount ac where ac.shortname= :accountShortname";
	paramsHql.put("accountShortname", iData[0]);
	result2 = helper.executeHqlQuery(hql2, paramsHql);
	
    var iParamsHql1 = new java.util.HashMap();
	var hql1 = "from Entity en where en.shortname= :entityShortname";
	iParamsHql1.put("entityShortname", iData[1]);
	result1 = helper.executeHqlQuery(hql1, iParamsHql1);
	
    if (iData[2] != null)
		row[iHeaderMap.get("currency")] = iData[2];

	if (iData[3] != null)
		row[iHeaderMap.get("AccEntryInternalStatus")] = iData[3];
	
	row[iHeaderMap.get("originOpeningBalance")] = helper.bigDecimal(0);
	if (iData[4] != null)
		row[iHeaderMap.get("openingBalance")] = iData[4];
	row[iHeaderMap.get("originClosingBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("closingBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originCreditMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originDebitMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("creditMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("debitMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("excelIndex")] = helper.bigDecimal(1);
	row[iHeaderMap.get("rowDescription")] = 'O';

	var cachedAccAccount = cashAccountingAccount.get(iData[0]);
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, result2.get(0));
		cashAccountingAccount.put(iData[0], cachedAccAccount);
	}
	var cachedEntity = cashEntity.get(iData[1]);
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, result1.get(0));
		cashEntity.put(iData[1], cachedEntity);
	}
	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);

	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}

function fillRows1(iHeader, iHeaderMap, iData) {

	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	var paramsHql = new java.util.HashMap();
	var hql2 = "from AccountingAccount ac where ac.shortname= :accountShortname";
	paramsHql.put("accountShortname", iData[0]);
	result2 = helper.executeHqlQuery(hql2, paramsHql);

	var iParamsHql1 = new java.util.HashMap();
	var hql1 = "from Entity en where en.shortname= :entityShortname";
	iParamsHql1.put("entityShortname", iData[1]);
	result1 = helper.executeHqlQuery(hql1, iParamsHql1);

	if (iData[2] != null)
		row[iHeaderMap.get("currency")] = iData[2];

	if (iData[3] != null)
		row[iHeaderMap.get("AccEntryInternalStatus")] = iData[3];
	row[iHeaderMap.get("originClosingBalance")] = helper.bigDecimal(0);
	if (iData[4] != null)
		row[iHeaderMap.get("closingBalance")] = iData[4];
	row[iHeaderMap.get("originOpeningBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("openingBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originCreditMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originDebitMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("creditMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("debitMovement")] = helper.bigDecimal(0);
	row[iHeaderMap.get("excelIndex")] = helper.bigDecimal(3);
	row[iHeaderMap.get("rowDescription")] = 'C';

	var cachedAccAccount = cashAccountingAccount.get(iData[0]);
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, result2.get(0));
		cashAccountingAccount.put(iData[0], cachedAccAccount);
	}

    var cachedEntity = cashEntity.get(iData[1]);
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, result1.get(0));
		cashEntity.put(iData[1], cachedEntity);
	}
	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);

	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}

function fillRows2(iHeader, iHeaderMap, iData) {

	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);
	var oParamsHql = new java.util.HashMap();
	var hql2 = "from AccountingAccount ac where ac.shortname= :accountShortname";
	oParamsHql.put("accountShortname", iData[0]);
	result2 = helper.executeHqlQuery(hql2, oParamsHql);

	var iParamsHql1 = new java.util.HashMap();
	var hql1 = "from Entity en where en.shortname= :entityShortname";
	iParamsHql1.put("entityShortname", iData[1]);
	result1 = helper.executeHqlQuery(hql1, iParamsHql1);

	if (iData[2] != null)
		row[iHeaderMap.get("currency")] = iData[2];

	if (iData[4] != null)
		row[iHeaderMap.get("origincurrency")] = iData[4];
	if (iData[5] != null)
		row[iHeaderMap.get("folder")] = iData[5];

	if (iData[3] != null)
		row[iHeaderMap.get("cpty")] = iData[3];

	if (iData[6] != null)
		row[iHeaderMap.get("AccEntryInternalStatus")] = iData[6];
	if (iData[7] != null)
		row[iHeaderMap.get("accountingMouvementId")] = iData[7];
	if (iData[8] != null)
		row[iHeaderMap.get("accountingEntryId")] = iData[8];
	if (iData[9] != null)
		row[iHeaderMap.get("accountingDate")] = iData[9];
	if (iData[10] != null)
		row[iHeaderMap.get("valueDate")] = iData[10];
	if (iData[11] != null)
		row[iHeaderMap.get("accountingRate")] = iData[11];
	if (iData[12] != null)
		row[iHeaderMap.get("description")] = iData[12];

	row[iHeaderMap.get("openingBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originOpeningBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("originClosingBalance")] = helper.bigDecimal(0);
	row[iHeaderMap.get("closingBalance")] = helper.bigDecimal(0);
/*
	credit = computeMovement(iData[0], iData[1], iData[2], iData[4], iData[3], "credit");
	debit = computeMovement(iData[0], iData[1], iData[2], iData[4], iData[3], "debit");
*/

/*
	row[iHeaderMap.get("creditMovement")] = credit;
	row[iHeaderMap.get("debitMovement")] = debit;
*/
	row[iHeaderMap.get("excelIndex")] = helper.bigDecimal(2);
	row[iHeaderMap.get("rowDescription")] = 'M';

	var cachedAccAccount = cashAccountingAccount.get(iData[0]);
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, result2.get(0));
		cashAccountingAccount.put(iData[0], cachedAccAccount);
	}
	var cachedEntity = cashEntity.get(iData[1]);
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, result1.get(0));
		cashEntity.put(iData[1], cachedEntity);
	}

	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);

	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}


function computeMovement(iAccountShortname,iEntity, iCurrency,iCurrencyOrigin,iCpty,type) {
	var paramsHql = new java.util.HashMap();
	var hql = "select sum(accMvt.amount* accMvt.sign),accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname from AccountingMovement accMvt"
	hql += " where accMvt.accountingAccount.shortname = :accountShortname";
    hql+= " and accMvt.accountingEntry.entity.shortname = :entityShortname";
	hql+= " and accMvt.currency.shortname = :currencyShortname";
	hql+= " and accMvt.currencyOrigin.shortname = :originCurrencyShortname";
	hql+= " and accMvt.cpty.shortname = :cptyShortname";	
	

    if (params.get("dateType") == "V") {
		hql += " and  accMvt.valueDate <= :endDate";
		hql += " and  accMvt.valueDate >= :startDate";

	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :endDate";
		hql += " and accMvt.accountingEntry.accountingDate >= :startDate";

	}
	
	if (type == "credit")
		hql += " and accMvt.sign > 0";
	else
		hql += " and accMvt.sign < 0";

    hql += "group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname"
    
    paramsHql.put("startDate", helper.parseDate(params.get("startDate")));
	paramsHql.put("endDate", helper.parseDate(params.get("endDate")));


	paramsHql.put("accountShortname", iAccountShortname);
	paramsHql.put("entityShortname", iEntity);
	paramsHql.put("currencyShortname", iCurrency);
	paramsHql.put("originCurrencyShortname", iCurrency);
	paramsHql.put("cptyShortname", iCpty);
	result = helper.executeHqlQuery(hql, paramsHql);
	if (result.size() > 0) {
			amount = result.get(0)[0];
    }
	else{
	    amount = helper.bigDecimal(0) ; 
	}
	return amount;
}

function getOpeningBalance(iParams) {
	var iParamsHql = new java.util.HashMap();

	var hql = "select accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
		accMvt.accountingEntry.applicativeStatus.internalStatus,sum(accMvt.amount* accMvt.sign)"
		hql += " from AccountingMovement accMvt ";

	hql += " where " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingAccountList"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("currencyList"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", iParams.get("cptyList"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entityList"));
	hql += " and " + helper.buildListFilter(" (select fv.customDictionaryValue.id from FieldValue fv where fv.field.id = " + helper.getUserDataFieldDefinition("accountingAccountAddInfo.accountingNorm").getId() + " and fv.dataEntityType = 'accountingAccount' and accMvt.accountingAccount.id = fv.dataEntityId)", iParams.get("accountingNormList"));
	hql += " and " + helper.buildListFilter("accMvt.currencyOrigin.id", iParams.get("originCurrencyList"));
	//	hql+= "and ent.id in (select CODE from TABLE( MccFilter.grantedList('ENTITY', 'INTERNAL_SCOPE_FK', 'entity', 'children', [:scope]))) ";
	//condition += " and (" + helper.createFilter(params.get("scope"), DiapasonFilter.CHILDREN, "ti.paymentInfo.cashAccount", "internalScope", DiapasonFilter.INTERNAL_CASH_ACCOUNT) + " or " + helper.createFilter(params.get("scope"), DiapasonFilter.CHILDREN, "ti.paymentInfo.cashAccount.bankEntity", "internalScope", DiapasonFilter.INTERNAL_ENTITY) + ")";
	if (iParams.get("accountingGroup") == "true") {
		if (iParams.get("accountingNotInGroup") != "true")
			hql += " and accMvt.cpty.isTrade = 1 ";
	} else {
		if (iParams.get("accountingNotInGroup") == "true")
			hql += " and accMvt.cpty.isTrade = 0 ";
		else
			hql += " and 0 = 1 ";
	}

	if (StringUtils.isNotBlank(iParams.get("statusList")) == true)
		hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus.id", iParams.get("statusList"));
	else
		hql += " and accMvt.accountingEntry.applicativeStatus.internalStatus in ('validated') ";

	if (iParams.get("dateType") == "V") {
		hql += " and  accMvt.valueDate <= :startDate";
	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :startDate";

	}
	iParamsHql.put("startDate", helper.parseDate(iParams.get("startDate")));

	hql +=" group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
	accMvt.accountingEntry.applicativeStatus.internalStatus"
	return [hql, iParamsHql];
}

function getClosingBalance(iParams) {
	var iParamsHql = new java.util.HashMap();

	var hql = "select accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
		accMvt.accountingEntry.applicativeStatus.internalStatus,sum(accMvt.amount* accMvt.sign)"
		hql += " from AccountingMovement accMvt ";

	hql += " where " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingAccountList"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("currencyList"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", iParams.get("cptyList"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entityList"));
	hql += " and " + helper.buildListFilter(" (select fv.customDictionaryValue.id from FieldValue fv where fv.field.id = " + helper.getUserDataFieldDefinition("accountingAccountAddInfo.accountingNorm").getId() + " and fv.dataEntityType = 'accountingAccount' and accMvt.accountingAccount.id = fv.dataEntityId)", iParams.get("accountingNormList"));
	hql += " and " + helper.buildListFilter("accMvt.currencyOrigin.id", iParams.get("originCurrencyList"));
	//	hql+= "and ent.id in (select CODE from TABLE( MccFilter.grantedList('ENTITY', 'INTERNAL_SCOPE_FK', 'entity', 'children', [:scope]))) ";
	if (iParams.get("accountingGroup") == "true") {
		if (iParams.get("accountingNotInGroup") != "true")
			hql += " and accMvt.cpty.isTrade = 1 ";
	} else {
		if (iParams.get("accountingNotInGroup") == "true")
			hql += " and accMvt.cpty.isTrade = 0 ";
		else
			hql += " and 0 = 1 ";
	}

	if (StringUtils.isNotBlank(iParams.get("statusList")) == true)
		hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus.id", iParams.get("statusList"));
	else
		hql += " and accMvt.accountingEntry.applicativeStatus.internalStatus in ('validated') ";

	if (iParams.get("dateType") == "V") {
		hql += " and  accMvt.valueDate <= :endDate";
	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :endDate";

	}
	iParamsHql.put("endDate", helper.parseDate(iParams.get("endDate")));

	hql += " group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
	accMvt.accountingEntry.applicativeStatus.internalStatus"
	return [hql, iParamsHql];
}

function getAccountingMovement(iParams) {
	var iParamsHql = new java.util.HashMap();

	var hql = "select accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,\
		accMvt.cpty.shortname,accMvt.currencyOrigin.shortname,accMvt.folder.id,accMvt.accountingEntry.applicativeStatus.internalStatus,accMvt.id,accMvt.accountingEntry.id, \
		accMvt.accountingEntry.accountingDate,accMvt.valueDate,accMvt.rate,accMvt.description,sum(accMvt.amount)"
	hql += " from AccountingMovement accMvt ";

	hql += " where " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingAccountList"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("currencyList"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", iParams.get("cptyList"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entityList"));
	hql += " and " + helper.buildListFilter(" (select fv.customDictionaryValue.id from FieldValue fv where fv.field.id = " + helper.getUserDataFieldDefinition("accountingAccountAddInfo.accountingNorm").getId() + " and fv.dataEntityType = 'accountingAccount' and accMvt.accountingAccount.id = fv.dataEntityId)", iParams.get("accountingNormList"));
	hql += " and " + helper.buildListFilter("accMvt.originCurrency.id", iParams.get("originCurrencyList"));
	//	hql+= "and ent.id in (select CODE from TABLE( MccFilter.grantedList('ENTITY', 'INTERNAL_SCOPE_FK', 'entity', 'children', [:scope]))) ";
	if (iParams.get("accountingGroup") == "true") {
		if (iParams.get("accountingNotInGroup") != "true")
			hql += " and accMvt.cpty.isTrade = 1 ";
	} else {
		if (iParams.get("accountingNotInGroup") == "true")
			hql += " and accMvt.cpty.isTrade = 0 ";
		else
			hql += " and 0 = 1 ";
	}
	if (StringUtils.isNotBlank(iParams.get("statusList")) == true)
		hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus.id", iParams.get("statusList"));
	else
		hql += " and accMvt.accountingEntry.applicativeStatus.internalStatus in ('validated') ";

	if (iParams.get("dateType") == "V") {
		hql += " and  accMvt.valueDate <= :endDate";
		hql += " and  accMvt.valueDate >= :startDate";

	} else {
		hql += " and accMvt.accountingEntry.accountingDate <= :endDate";
		hql += " and accMvt.accountingEntry.accountingDate >= :startDate";

	}
	iParamsHql.put("startDate", helper.parseDate(iParams.get("startDate")));

	
	iParamsHql.put("endDate", helper.parseDate(iParams.get("endDate")));

	hql += " group by accMvt.accountingAccount.shortname,accMvt.accountingEntry.entity.shortname,accMvt.currency.shortname,accMvt.currencyOrigin.shortname,\
	accMvt.cpty.shortname,accMvt.folder.id,accMvt.accountingEntry.applicativeStatus.internalStatus,accMvt.id,accMvt.accountingEntry.id,\
	accMvt.accountingEntry.accountingDate,accMvt.valueDate,accMvt.rate,accMvt.description"
	return [hql, iParamsHql];
}

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

function completeRowFromMap(iHeaderMap, iMap, oRow) {
	for (var itM = iMap.entrySet().iterator(); itM.hasNext(); ) {
		var entry = itM.next();
		oRow[iHeaderMap.get(entry.getKey())] = entry.getValue();
	}
}
