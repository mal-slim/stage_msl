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
 * This rule generate an excel export of Accounting Journal Xls
 *
 * @author mcc
 */

importClass(Packages.com.mccsoft.diapason.excel.util.ExcelRangeResult);
importClass(Packages.org.apache.commons.lang.StringUtils);
importClass(Packages.com.mccsoft.diapason.util.DiapasonFilter);
uselib(globalVariableLibrary);
uselib(reportParametersLibrary);
uselib(excelLibrary);

var params = reportParamInitialization(source);

var expressionContextId = helper.getTransientValue("expressionContextId");
var expressionContextTmp = null; // this value is used as a test
var expressionContextShortname = null;

if (null != expressionContextId) {
	expressionContextTmp = helper.load(com.mccsoft.diapason.data.expressionLanguage.ExpressionContext, helper.parseLong(expressionContextId));
	expressionContextShortname = expressionContextTmp.getShortname();
}
if (null != expressionContextTmp) {
	expressionContextShortname = expressionContextTmp.getShortname();
} else {
	expressionContextShortname = "stdAccountingJournalXls";
}
var header = ["accountingEntryId", "am_id", "amountOther", "description", "rate", "rateOther", "amountOrigin", "valueDate", "sign", "externalReference", "am_lastUpdate", "amount", "currencyOther", "cpty",
	"currencyOrigin", "amlastUser", "currency", "ae_lastUser", "applicativeStatus", "processDate", "exportDate", "processId", "lastUpdate", "reference", "processDate",
	"accountingDate", "creditAmountOri", "debitAmountOri", "creditAmount", "debitAmount", "signChar", "folder",
	"extraInfo"
];

var header = header.concat(getContextColumns(expressionContextShortname));
[hql, paramsHql] = getHqlAccountingMovement(params);
header = addExtraInfoToHeader(hql, paramsHql, header);

var hqlList = [];
hqlList.push({
	hql: [hql],
	hqlParams: paramsHql,
	rowsFunction: fillRows
});

var cashAccountingAccount = new java.util.HashMap();
var cashEntity = new java.util.HashMap();

createHqlReport("stdAccounting", hqlList, header);

/**
 * Function to retrieve header. Must iterate a first time only for header
 * @param {*} iHeader
 * @param {*} iHeaderMap
 * @param {*} iData
 */

function addExtraInfoToHeader(hql, iParamsHql, oHeader) {
	helper.createScrollableHqlQuery(hql, iParamsHql);
	while (helper.hasMoreResults()) {
		var entries = helper.getNextResults();
		fillInHeader(entries, oHeader);
	}
	helper.closeScrollableQuery();

	return header;
}

function fillInHeader(iEntries, oHeader) {
	for (var iterator = iEntries.iterator(); iterator.hasNext();) {
		var entry = iterator.next();
		var iMap = getExtraInfoMap(entry);
		for (var it = iMap.keySet().iterator(); it.hasNext();) {
			var item = it.next();
			if (oHeader.indexOf(String(item)) == -1) {
				oHeader.push(String(item));
			}
		}
	}

}

function fillRows(iHeader, iHeaderMap, iData) {
	var row = java.lang.reflect.Array.newInstance(java.lang.Object, iHeader.length);

	// Fill rows with accounting entry and accounting movement information
	fillEach(iHeaderMap, iData, row);

	// Provide information from expression context
	var cachedAccAccount = cashAccountingAccount.get(iData[0].getAccountingAccount().getShortname());
	if (cachedAccAccount == null) {
		cachedAccAccount = helper.eval(expressionContextShortname, iData[0].getAccountingAccount());
		cashAccountingAccount.put(iData[0].getAccountingAccount().getShortname(), cachedAccAccount);
	}
	var cachedEntity = cashEntity.get(iData[0].getAccountingEntry().getEntity().getShortname());
	if (cachedEntity == null) {
		cachedEntity = helper.eval(expressionContextShortname, iData[0].getAccountingEntry().getEntity());
		cashEntity.put(iData[0].getAccountingEntry().getEntity().getShortname(), cachedEntity);
	}

	completeRowFromMap(iHeaderMap, cachedAccAccount, row);
	completeRowFromMap(iHeaderMap, cachedEntity, row);

	// Provide information from extraInfo column "key1:value1,key2:value2..."
	var hMap = getExtraInfoMap(iData);
	completeRowFromMap(iHeaderMap, hMap, row);
	var rows = new java.util.ArrayList();
	rows.add(row);
	return rows;
}

/**
 * Function to add information from a map
 * @param {*} iMap
 * @param {*} oHeader
 */

function getExtraInfoMap(iData) {
	var hMap = new java.util.HashMap();
	//In case of standard extraInfo, manage to split extraInfo like standard columns
	var extra = iData[0].getExtraInfo();
	if (StringUtils.isNotBlank(extra)) {
		var split = extra.split(",");
		for (var i = 0; i < split.length; i++) {
			if (split[i] != "") {
				var split1 = split[i].split(":");
				if (split1[0] != ""){
					var value = "";
					if(split1.length > 1)
						value = split1[1];
					hMap.put(split1[0], value);
				}
			}
		}
	}
	return hMap;
}

function fillEach(iHeaderMap, iData, row) {
	row[iHeaderMap.get("amountOther")] = iData[0].getAmountOther();
	row[iHeaderMap.get("description")] = iData[0].getDescription();
	row[iHeaderMap.get("rate")] = iData[0].getRate();
	row[iHeaderMap.get("rateOther")] = iData[0].getRateOther();
	row[iHeaderMap.get("amountOrigin")] = iData[0].getAmountOrigin();
	row[iHeaderMap.get("valueDate")] = iData[0].getValueDate();
	row[iHeaderMap.get("sign")] = iData[0].getSign();
	row[iHeaderMap.get("externalReference")] = iData[0].getExternalReference();
	row[iHeaderMap.get("am_lastUpdate")] = iData[0].getLastUpdate();
	row[iHeaderMap.get("am_id")] = iData[0].getId();
	row[iHeaderMap.get("extraInfo")] = iData[0].getExtraInfo();
	row[iHeaderMap.get("amount")] = iData[0].getAmount();
	row[iHeaderMap.get("exportDate")] = iData[0].getAccountingEntry().getExportDate();
	row[iHeaderMap.get("processDate")] = iData[0].getAccountingEntry().getProcessDate();
	row[iHeaderMap.get("processId")] = iData[0].getAccountingEntry().getProcessId();
	row[iHeaderMap.get("lastUpdate")] = iData[0].getAccountingEntry().getLastUpdate();
	row[iHeaderMap.get("reference")] = iData[0].getAccountingEntry().getReference();
	row[iHeaderMap.get("accountingEntryId")] = iData[0].getAccountingEntry().getId();
	row[iHeaderMap.get("accountingDate")] = iData[0].getAccountingEntry().getAccountingDate();
	if (iData[0].getCurrency() != null)
		row[iHeaderMap.get("currency")] = iData[0].getCurrency().getShortname();
	if (iData[0].getCurrencyOther() != null)
		row[iHeaderMap.get("currencyOther")] = iData[0].getCurrencyOther().getShortname();
	if (iData[0].getCpty() != null)
		row[iHeaderMap.get("cpty")] = iData[0].getCpty().getShortname();
	if (iData[0].getCurrencyOrigin() != null)
		row[iHeaderMap.get("currencyOrigin")] = iData[0].getCurrencyOrigin().getShortname();
	if (iData[0].getLastUser() != null)
		row[iHeaderMap.get("amlastUser")] = iData[0].getLastUser().getShortname();
	if (iData[0].getAccountingEntry().getLastUser() != null)
		row[iHeaderMap.get("ae_lastUser")] = iData[0].getAccountingEntry().getLastUser().getShortname();
	if (iData[0].getAccountingEntry().getApplicativeStatus() != null)
		row[iHeaderMap.get("applicativeStatus")] = iData[0].getAccountingEntry().getApplicativeStatus().getShortname();
	if (iData[0].getFolder() != null)
		row[iHeaderMap.get("currencyOrigin")] = iData[0].getFolder().getShortname();
	if (iData[0].getSign() == 1) {
		row[iHeaderMap.get("creditAmountOri")] = iData[0].getAmountOrigin();
		row[iHeaderMap.get("debitAmountOri")] = helper.bigDecimal(0);
		row[iHeaderMap.get("signChar")] = "Credit";
	} else {
		row[iHeaderMap.get("creditAmountOri")] = helper.bigDecimal(0);
		row[iHeaderMap.get("debitAmountOri")] = iData[0].getAmountOrigin();
		row[iHeaderMap.get("signChar")] = "Debit";
	}
	if (iData[0].getSign() == -1)
		row[iHeaderMap.get("debitAmount")] = iData[0].getAmount();
	else
		row[iHeaderMap.get("debitAmount")] = helper.bigDecimal(0);

	if (iData[0].getSign() == 1)
		row[iHeaderMap.get("creditAmount")] = iData[0].getAmount();
	else
		row[iHeaderMap.get("creditAmount")] = helper.bigDecimal(0);

}

function updateHeaderFromMap(iMap, oHeader) {
	for (var it = iMap.keySet().iterator(); it.hasNext();) {
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
	for (var itM = iMap.entrySet().iterator(); itM.hasNext();) {
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
 * @return hql and iParams
 */
function getHqlAccountingMovement(iParams) {
	var scopeId = (iParams.get("scope") != null) ? iParams.get("scope") : iParams.get("_scopeId");
	var hql = "	from AccountingMovement accMvt ";
	hql += "where" + helper.createFilter(scopeId, DiapasonFilter.CHILDREN, "accMvt.accountingEntry.entity", "internalScope", DiapasonFilter.INTERNAL_ENTITY);
	var iParamsHql = new java.util.HashMap();

	if (iParams.get("accountingDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.accountingDate >= :accountingDateFrom";
		iParamsHql.put("accountingDateFrom", helper.parseDate(iParams.get("accountingDateFrom")));
	}
	if (iParams.get("accountingDateTo") != null) {

		hql += " and  accMvt.accountingEntry.accountingDate <= :accountingDateTo)";
		iParamsHql.put("accountingDateTo", helper.parseDate(iParams.get("accountingDateTo")));
	}
	if (iParams.get("lastUpdateFrom") != null) {
		hql += " and  accMvt.lastUpdate >= :lastUpdateFrom";
		iParamsHql.put("lastUpdateFrom", helper.parseDate(iParams.get("lastUpdateFrom")));
	}
	if (iParams.get("lastUpdateTo") != null) {
		hql += " and  accMvt.lastUpdate <= :lastUpdateTo";
		iParamsHql.put("lastUpdateTo", helper.parseDate(iParams.get("lastUpdateTo")));
	}
	if (iParams.get("processDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.processDate >= :processDateFrom";
		iParamsHql.put("processDateFrom", helper.parseDate(iParams.get("processDateFrom")));
	}
	if (iParams.get("processDateTo") != null) {
		hql += " and  accMvt.accountingEntry.processDate <= :processDateTo";
		iParamsHql.put("processDateTo", helper.parseDate(iParams.get("processDateTo")));
	}
	if (iParams.get("exportDateFrom") != null) {
		hql += " and  accMvt.accountingEntry.exportDate >= :exportDateFrom";
		iParamsHql.put("exportDateFrom", helper.parseDate(iParams.get("exportDateFrom")));
	}
	if (iParams.get("exportDateTo") != null) {
		hql += " and  accMvt.accountingEntry.exportDate <= :exportDateTo";
		iParamsHql.put("exportDateTo", helper.parseDate(iParams.get("exportDateTo")));
	}

	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.entity.id", iParams.get("entity"));
	hql += " and " + helper.buildListFilter("accMvt.folder.id", iParams.get("folder"));
	hql += " and " + helper.buildListFilter("accMvt.cpty.id", iParams.get("cpty"));
	hql += " and " + helper.buildListFilter("accMvt.currency.id", iParams.get("accountingCurrency"));
	hql += " and " + helper.buildListFilter("accMvt.currencyOrigin.id", iParams.get("currencyOrigin"));
	hql += " and " + helper.buildListFilter("accMvt.accountingAccount.id", iParams.get("accountingaccount"));
	hql += " and " + helper.buildListFilter("accMvt.accountingEntry.applicativeStatus.id", iParams.get("applicativeStatus"));

	if (iParams.get("accountingEntryIdFrom") != null) {
		hql += " and  accMvt.accountingEntry.id >= :accountingEntryIdFrom";
		iParamsHql.put("accountingEntryIdFrom", helper.parseLong(iParams.get("accountingEntryIdFrom")));
	}
	if (iParams.get("accountingEntryIdTo") != null) {
		hql += " and  accMvt.accountingEntry.id <= :accountingEntryIdTo";
		iParamsHql.put("accountingEntryIdTo", helper.parseLong(iParams.get("accountingEntryIdTo")));
	}
	if (iParams.get("amountFrom") != null) {
		hql += " and  accMvt.amount >= :amountFrom";
		iParamsHql.put("amountFrom", helper.parseNumber(iParams.get("amountFrom")));
	}
	if (iParams.get("amountTo") != null) {
		hql += " and  accMvt.amount <= :amountTo";
		iParamsHql.put("amountTo", helper.parseNumber(iParams.get("amountTo")));
	}
	if (iParams.get("description") != null) {
		hql += " and  accMvt.description like :description";
		iParamsHql.put("description", iParams.get("description"));
	}
	if (StringUtils.isNotBlank(iParams.get("tradeId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM EventLink el where el.dataEntity.shortname = 'accountingEntry' \
        and el.dataEntityId=accMvt.accountingEntry.id \
        and el.event.trade.id = " + iParams.get("tradeId") + ")";
	}
	if (StringUtils.isNotBlank(iParams.get("eventId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM EventLink el where el.dataEntity.shortname = 'accountingEntry' \
        and el.dataEntityId=accMvt.accountingEntry.id \
        and el.event.id = " + iParams.get("eventId") + ")";
	}
	if (StringUtils.isNotBlank(iParams.get("movementId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM CashMovementLink cshMvtLnk where cshMvtLnk.dataEntity.shortname = 'accountingEntry' \
        and cshMvtLnk.dataEntityId = accMvt.accountingEntry.id \
        and cshMvtLnk.cashMovement.id = " + iParams.get("movementId") + ")";
	}
	if (StringUtils.isNotBlank(iParams.get("processId")) == true) {
		hql += " AND EXISTS(SELECT 1 FROM ProcessLink prcLnk where prcLnk.dataEntity.shortname = 'accountingEntry' \
        and prcLnk.dataEntityId=accMvt.accountingEntry.id \
        and prcLnk.process.id = " + iParams.get("processId") + ")";
	}
	if (iParams.get("onlyIsolatedAccountingEntry") == "true") {
		hql += " AND NOT EXISTS(SELECT 1 FROM ProcessLink prcLnk where prcLnk.dataEntity.shortname = 'accountingEntry' \
        and prcLnk.dataEntityId=accMvt.accountingEntry.id )"; //mettre a la fin
	}
	hql += " order by accMvt.accountingEntry.id asc ";
	return [hql, iParamsHql];
}



