// Redesigned by t.me/TheFirstSpeedster from https://github.com/ParveenBhadooOfficial/Bhadoo-Drive-Index which was written by someone else, credits are given on Source Page.

// Initialize the page
function init() {
	document.siteName = $('title').html();
	var html = `
<header >
   <div id="nav">
   </div>
</header>
<div>
<div id="content">
</div>
<br>  `;
	$('body').html(html);
}

const Os = {
	isWindows: navigator.platform.toUpperCase().indexOf('WIN') > -1, // .includes
	isMac: navigator.platform.toUpperCase().indexOf('MAC') > -1,
	isMacLike: /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform),
	isIos: /(iPhone|iPod|iPad)/i.test(navigator.platform),
	isMobile: /Android|webOS|iPhone|iPad|iPod|iOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
};

function getDocumentHeight() {
	var D = document;
	return Math.max(
		D.body.scrollHeight, D.documentElement.scrollHeight,
		D.body.offsetHeight, D.documentElement.offsetHeight,
		D.body.clientHeight, D.documentElement.clientHeight
	);
}

function render(path) {
	if (path.indexOf("?") > 0) {
		path = path.substr(0, path.indexOf("?"));
	}
	title(path);
	nav(path);
	// .../0: This
	var reg = /\/\d+:$/g;
	if (window.MODEL.is_search_page) {
		// Used to store the state of some scroll events
		window.scroll_status = {
			// Whether the scroll event is bound
			event_bound: false,
			// "Scroll to the bottom, loading more data" event lock
			loading_lock: false
		};
		render_search_result_list()
	} else if (path.match(reg) || path.substr(-1) == '/') {
		// Used to store the state of some scroll events
		window.scroll_status = {
			// Whether the scroll event is bound
			event_bound: false,
			// "Scroll to the bottom, loading more data" event lock
			loading_lock: false
		};
		list(path);
	} else {
		file(path);
	}
}


// Render title
function title(path) {
	path = decodeURI(path);
	var cur = window.current_drive_order || 0;
	var drive_name = window.drive_names[cur];
	path = path.replace(`/${cur}:`, '');
	// $('title').html(document.siteName + ' - ' + path);
	var model = window.MODEL;
	if (model.is_search_page)
		$('title').html(`${drive_name} - Search results for ${model.q} `);
	else
		$('title').html(`${drive_name} - ${path}`);
}


// Render the navigation bar
function nav(path) {
	var model = window.MODEL;
	var html = "";
	var cur = window.current_drive_order || 0;
	html += `<nav class="navbar navbar-dark bg-dark">
  <div class="navbar-toggler">
`
	var search_text = model.is_search_page ? (model.q || '') : '';
	var search_bar = `
<form class="form-inline" method="get" action="/${cur}:search">
<input class="form-control" name="q" type="search" placeholder="Search" aria-label="Search" value="${search_text}" required>
<button class="btn ${UI.dark_mode ? 'btn-secondary' : 'btn-outline-success'} my-2 my-sm-0" onclick="if($('#search_bar').hasClass('mdui-textfield-expanded') && $('#search_bar_form>input').val()) $('#search_bar_form').submit();" type="submit">Search</button>
</form>
</div>
</nav>
`;
	// Personal or team
	if (model.root_type < 2) {
		// Show search box
		html += search_bar;
	}

	$('#nav').html(html);
	mdui.mutation();
	mdui.updateTextFields();
}

/**
 * Initiate POST request for listing
 * @param path Path
 * @param params Form params
 * @param resultCallback Success Result Callback
 * @param authErrorCallback Pass Error Callback
 */
function requestListPath(path, params, resultCallback, authErrorCallback) {
	var p = {
		password: params['password'] || null,
		page_token: params['page_token'] || null,
		page_index: params['page_index'] || 0
	};
	$.post(path, p, function (data, status) {
		var res = jQuery.parseJSON(data);
		if (res && res.error && res.error.code == '401') {
			// Password verification failed
			if (authErrorCallback) authErrorCallback(path)
		} else if (res && res.data) {
			if (resultCallback) resultCallback(res, path, p)
		}
	})
}

/**
 * Search POST request
 * @param params Form params
 * @param resultCallback Success callback
 */
function requestSearch(params, resultCallback) {
	var p = {
		q: params['q'] || null,
		page_token: params['page_token'] || null,
		page_index: params['page_index'] || 0
	};
	$.post(`/${window.current_drive_order}:search`, p, function (data, status) {
		var res = jQuery.parseJSON(data);
		if (res && res.data) {
			if (resultCallback) resultCallback(res, p)
		}
	})
}

// Render file list
function list(path) {
	var content = `
  <div class="container"><br>
  <div class="card">
  <h5 class="card-header" id="folderne"><input type="text" id="folderne" class="form-control" placeholder="Current Path: Homepage" value="" readonly><script>document.getElementById("folderne").innerHTML='Current Folder: '+decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')-1))).replace('/','').replace('/','');</script>
  </h5>
  <div id="list" class="list-group">
  </div>
  </div>
  <div class="card">
  <div id="readme_md" style="display:none; padding: 20px 20px;"></div>
  </div>
  </div>
  `;
	$('#content').html(content);

	var password = localStorage.getItem('password' + path);
	$('#list').html(`<div class="d-flex justify-content-center"><div class="spinner-border m-5 text-primary" role="status"><span class="sr-only">Loading...</span></div></div>`);
	$('#readme_md').hide().html('');
	$('#head_md').hide().html('');

	/**
	 * Callback after the column list request successfully returns data
	 * The result returned by @param res (object)
	 * @param path the requested path
	 * @param prevReqParams parameters used in request
	 */
	function successResultCallback(res, path, prevReqParams) {

		// Temporarily store nextPageToken and currentPageIndex in the list element
		$('#list')
			.data('nextPageToken', res['nextPageToken'])
			.data('curPageIndex', res['curPageIndex']);

		// Remove loading spinner
		$('#spinner').remove();

		if (res['nextPageToken'] === null) {
			// If it is the last page, unbind the scroll event, reset scroll_status, and append the data
			$(window).off('scroll');
			window.scroll_status.event_bound = false;
			window.scroll_status.loading_lock = false;
			append_files_to_list(path, res['data']['files']);
		} else {
			// If it is not the last page, append data and bind the scroll event (if not already bound), update scroll_status
			append_files_to_list(path, res['data']['files']);
			if (window.scroll_status.event_bound !== true) {
				// Bind event, if not yet bound
				$(window).on('scroll', function () {
					var scrollTop = $(this).scrollTop();
					var scrollHeight = getDocumentHeight();
					var windowHeight = $(this).height();
					// Roll to the bottom
					if (scrollTop + windowHeight > scrollHeight - (Os.isMobile ? 130 : 80)) {
						/*
						    When the event of scrolling to the bottom is triggered, if it is already loading at this time, the event is ignored;
						    Otherwise, go to loading and occupy the loading lock, indicating that loading is in progress
						 */
						if (window.scroll_status.loading_lock === true) {
							return;
						}
						window.scroll_status.loading_lock = true;

						// Show a loading spinner
						$(`<div id="spinner" class="d-flex justify-content-center"><div class="spinner-border m-5 text-primary" role="status"><span class="sr-only">Loading...</span></div></div>`)
							.insertBefore('#readme_md');
						mdui.updateSpinners();
						// mdui.mutation();

						let $list = $('#list');
						requestListPath(path, {
								password: prevReqParams['password'],
								page_token: $list.data('nextPageToken'),
								// Request next page
								page_index: $list.data('curPageIndex') + 1
							},
							successResultCallback,
							// The password is the same as before. No authError
							null
						)
					}
				});
				window.scroll_status.event_bound = true
			}
		}

		// After loading successfully and rendering new data successfully, release the loading lock so that you can continue to process the "scroll to bottom" event
		if (window.scroll_status.loading_lock === true) {
			window.scroll_status.loading_lock = false
		}
	}

	// Start requesting data from page 1
	requestListPath(path, {
			password: password
		},
		successResultCallback,
		function (path) {
			$('#spinner').remove();
			var pass = prompt("Directory encryption, please enter the password", "");
			localStorage.setItem('password' + path, pass);
			if (pass != null && pass != "") {
				list(path);
			} else {
				history.go(-1);
			}
		});
}

/**
 * Append the data of the requested new page to the list
 * @param path
 * @param files request result
 */
function append_files_to_list(path, files) {
	var $list = $('#list');
	// Is it the last page of data?
	var is_lastpage_loaded = null === $list.data('nextPageToken');
	var is_firstpage = '0' == $list.data('curPageIndex');

	html = "";
	let targetFiles = [];
	for (i in files) {
		var item = files[i];
		var p = path + item.name + '/';
		if (item['size'] == undefined) {
			item['size'] = "";
		}

		item['modifiedTime'] = utc2beijing(item['modifiedTime']);
		item['size'] = formatFileSize(item['size']);
		if (item['mimeType'] == 'application/vnd.google-apps.folder') {
			html += `<a href="${p}" class="list-group-item ${UI.dark_mode ? 'list-group-item-action' : 'btn-outline-secondary'}"><svg width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><linearGradient id="WQEfvoQAcpQgQgyjQQ4Hqa" x1="24" x2="24" y1="6.708" y2="14.977" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#eba600"></stop><stop offset="1" stop-color="#c28200"></stop></linearGradient><path fill="url(#WQEfvoQAcpQgQgyjQQ4Hqa)" d="M24.414,10.414l-2.536-2.536C21.316,7.316,20.553,7,19.757,7L5,7C3.895,7,3,7.895,3,9l0,30	c0,1.105,0.895,2,2,2l38,0c1.105,0,2-0.895,2-2V13c0-1.105-0.895-2-2-2l-17.172,0C25.298,11,24.789,10.789,24.414,10.414z"></path><linearGradient id="WQEfvoQAcpQgQgyjQQ4Hqb" x1="24" x2="24" y1="10.854" y2="40.983" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd869"></stop><stop offset="1" stop-color="#fec52b"></stop></linearGradient><path fill="url(#WQEfvoQAcpQgQgyjQQ4Hqb)" d="M21.586,14.414l3.268-3.268C24.947,11.053,25.074,11,25.207,11H43c1.105,0,2,0.895,2,2v26	c0,1.105-0.895,2-2,2H5c-1.105,0-2-0.895-2-2V15.5C3,15.224,3.224,15,3.5,15h16.672C20.702,15,21.211,14.789,21.586,14.414z"></path></svg> ${item.name}<span class="badge-info badge-pill float-right csize">${item['size']}</span><span class="badge-primary badge-pill float-right cmtime">${item['modifiedTime']}</span></a>`;
		} else {
			var p = path + item.name;
			var pn = path + item.name;
			const filepath = path + item.name;
			var c = "file";
			// README is displayed after the last page is loaded, otherwise it will affect the scroll event
			if (is_lastpage_loaded && item.name == "README.md") {
				get_file(p, item, function (data) {
					markdown("#readme_md", data);
          $("img").addClass("img-fluid")
				});
			}
			if (item.name == "HEAD.md") {
				get_file(p, item, function (data) {
					markdown("#head_md", data);
          $("img").addClass("img-fluid")
				});
			}
			var ext = p.split('.').pop().toLowerCase();
			if ("|html|php|css|go|java|js|json|txt|sh|md|mp4|webm|avi|bmp|jpg|jpeg|png|gif|m4a|mp3|flac|wav|ogg|mpg|mpeg|mkv|rm|rmvb|mov|wmv|asf|ts|flv|pdf|".indexOf(`|${ext}|`) >= 0) {
				targetFiles.push(filepath);
				pn += "?a=view";
				c += " view";
			}
			html += `<div class="list-group-item ${UI.dark_mode ? 'list-group-item-action' : 'btn-outline-secondary'}"><a class="list-group-item-action" href="${pn}"><svg width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#50e6ff" d="M39,16v25c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h17L39,16z"></path><linearGradient id="F8F33TU9HxDNWNbQYRyY3a" x1="28.529" x2="33.6" y1="15.472" y2="10.4" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3079d6"></stop><stop offset="1" stop-color="#297cd2"></stop></linearGradient><path fill="url(#F8F33TU9HxDNWNbQYRyY3a)" d="M28,5v9c0,1.105,0.895,2,2,2h9L28,5z"></path></svg> ${item.name}</a><a href="${p}"><img class="float-right" src="https://cdn.jsdelivr.net/gh/ParveenBhadooOfficial/Bhadoo-Drive-Index@2.0.7/images/download-file.svg" width="25px"></a><span class="badge-info badge-pill float-right csize"> ${item['size']}</span><span class="badge-primary badge-pill float-right cmtime">${item['modifiedTime']}</span></div>`;
		}
	}

	/*let targetObj = {};
	targetFiles.forEach((myFilepath, myIndex) => {
	    if (!targetObj[myFilepath]) {
	        targetObj[myFilepath] = {
	            filepath: myFilepath,
	            prev: myIndex === 0 ? null : targetFiles[myIndex - 1],
	            next: myIndex === targetFiles.length - 1 ? null : targetFiles[myIndex + 1],
	        }
	    }
	})
	// console.log(targetObj)
	if (Object.keys(targetObj).length) {
	    localStorage.setItem(path, JSON.stringify(targetObj));
	    // console.log(path)
	}*/

	if (targetFiles.length > 0) {
		let old = localStorage.getItem(path);
		let new_children = targetFiles;
		// Reset on page 1; otherwise append
		if (!is_firstpage && old) {
			let old_children;
			try {
				old_children = JSON.parse(old);
				if (!Array.isArray(old_children)) {
					old_children = []
				}
			} catch (e) {
				old_children = [];
			}
			new_children = old_children.concat(targetFiles)
		}

		localStorage.setItem(path, JSON.stringify(new_children))
	}

	// When it is page 1, remove the horizontal loading bar
	$list.html(($list.data('curPageIndex') == '0' ? '' : $list.html()) + html);
	// When it is the last page, count and display the total number of items
	if (is_lastpage_loaded) {
		$('#count').removeClass('mdui-hidden').find('.number').text($list.find('li.mdui-list-item').length);
	}
}

/**
 * Render the search results list. There is a lot of repetitive code, but there are different logics in it.
 */
function render_search_result_list() {
	var content = `
  <div class="container"><br>
  <div class="card">
  <h5 class="card-header">Search Results</h5>
  <div id="list" class="list-group">
  </div>
  </div>
  </div>
  `;
	$('#content').html(content);

	$('#list').html(`<div class="d-flex justify-content-center"><div class="spinner-border m-5 text-primary" role="status"><span class="sr-only">Loading...</span></div></div>`);
	$('#readme_md').hide().html('');
	$('#head_md').hide().html('');

	/**
	 * Callback after successful search request returns data
	 * The result returned by @param res (object)
	 * @param path the requested path
	 * @param prevReqParams parameters used in request
	 */
	function searchSuccessCallback(res, prevReqParams) {

		// Temporarily store nextPageToken and currentPageIndex in the list element
		$('#list')
			.data('nextPageToken', res['nextPageToken'])
			.data('curPageIndex', res['curPageIndex']);

		// Remove loading spinner
		$('#spinner').remove();

		if (res['nextPageToken'] === null) {
			// If it is the last page, unbind the scroll event, reset scroll_status, and append the data
			$(window).off('scroll');
			window.scroll_status.event_bound = false;
			window.scroll_status.loading_lock = false;
			append_search_result_to_list(res['data']['files']);
		} else {
			// If it is not the last page, append data and bind the scroll event (if not already bound), update scroll_status
			append_search_result_to_list(res['data']['files']);
			if (window.scroll_status.event_bound !== true) {
				// Bind event, if not yet bound
				$(window).on('scroll', function () {
					var scrollTop = $(this).scrollTop();
					var scrollHeight = getDocumentHeight();
					var windowHeight = $(this).height();
					// Roll to the bottom
					if (scrollTop + windowHeight > scrollHeight - (Os.isMobile ? 130 : 80)) {
						/*
     When the event of scrolling to the bottom is triggered, if it is already loading at this time, the event is ignored;
                 Otherwise, go to loading and occupy the loading lock, indicating that loading is in progress
             */
						if (window.scroll_status.loading_lock === true) {
							return;
						}
						window.scroll_status.loading_lock = true;


						let $list = $('#list');
						requestSearch({
								q: window.MODEL.q,
								page_token: $list.data('nextPageToken'),
								// Request next page
								page_index: $list.data('curPageIndex') + 1
							},
							searchSuccessCallback
						)
					}
				});
				window.scroll_status.event_bound = true
				
			}
		}

		// After loading successfully and rendering new data successfully, release the loading lock so that you can continue to process the "scroll to bottom" event
		if (window.scroll_status.loading_lock === true) {
			window.scroll_status.loading_lock = false
			
		}
	}

	// Start requesting data from page 1
	requestSearch({
		q: window.MODEL.q
	}, searchSuccessCallback);
	
}

/**
 * Append a new page of search results
 * @param files
 */
function append_search_result_to_list(files) {
	var cur = window.current_drive_order || 0;
	var $list = $('#list');
	// Is it the last page of data?
	var is_lastpage_loaded = null === $list.data('nextPageToken');
	// var is_firstpage = '0' == $list.data('curPageIndex');

	html = "";

	for (i in files) {
		var item = files[i];
		var p = '/' + cur + ':/' + item.name + '/';
		if (item['size'] == undefined) {
			item['size'] = "";
		}

		item['modifiedTime'] = utc2beijing(item['modifiedTime']);
		item['size'] = formatFileSize(item['size']);
		if (item['mimeType'] == 'application/vnd.google-apps.folder') {
			html += `<a onclick="onSearchResultItemClick(this)" id="${item['id']}" class="list-group-item ${UI.dark_mode ? 'list-group-item-action' : 'btn-outline-secondary'}"><svg width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><linearGradient id="WQEfvoQAcpQgQgyjQQ4Hqa" x1="24" x2="24" y1="6.708" y2="14.977" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#eba600"></stop><stop offset="1" stop-color="#c28200"></stop></linearGradient><path fill="url(#WQEfvoQAcpQgQgyjQQ4Hqa)" d="M24.414,10.414l-2.536-2.536C21.316,7.316,20.553,7,19.757,7L5,7C3.895,7,3,7.895,3,9l0,30	c0,1.105,0.895,2,2,2l38,0c1.105,0,2-0.895,2-2V13c0-1.105-0.895-2-2-2l-17.172,0C25.298,11,24.789,10.789,24.414,10.414z"></path><linearGradient id="WQEfvoQAcpQgQgyjQQ4Hqb" x1="24" x2="24" y1="10.854" y2="40.983" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd869"></stop><stop offset="1" stop-color="#fec52b"></stop></linearGradient><path fill="url(#WQEfvoQAcpQgQgyjQQ4Hqb)" d="M21.586,14.414l3.268-3.268C24.947,11.053,25.074,11,25.207,11H43c1.105,0,2,0.895,2,2v26	c0,1.105-0.895,2-2,2H5c-1.105,0-2-0.895-2-2V15.5C3,15.224,3.224,15,3.5,15h16.672C20.702,15,21.211,14.789,21.586,14.414z"></path></svg> ${item.name}<span class="badge-info badge-pill float-right csize"> Can't Display Folder Size ${item['size']}</span><span class="badge-primary badge-pill float-right cmtime">${item['modifiedTime']}</span></a>`;
		} else {
			var p = '/' + cur + ':/' + item.name;
			var c = "file";
			var ext = item.name.split('.').pop().toLowerCase();
			if ("|html|php|css|go|java|js|json|txt|sh|md|mp4|webm|avi|bmp|jpg|jpeg|png|gif|m4a|mp3|flac|wav|ogg|mpg|mpeg|mkv|rm|rmvb|mov|wmv|asf|ts|flv|".indexOf(`|${ext}|`) >= 0) {
				p += "?a=view";
				c += " view";
			}
			html += `<a onclick="onSearchResultItemClick(this)" id="${item['id']}" gd-type="${item.mimeType}" class="list-group-item ${UI.dark_mode ? 'list-group-item-action' : 'btn-outline-secondary'}"><svg width="1.5em" height="1.5em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#50e6ff" d="M39,16v25c0,1.105-0.895,2-2,2H11c-1.105,0-2-0.895-2-2V7c0-1.105,0.895-2,2-2h17L39,16z"></path><linearGradient id="F8F33TU9HxDNWNbQYRyY3a" x1="28.529" x2="33.6" y1="15.472" y2="10.4" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#3079d6"></stop><stop offset="1" stop-color="#297cd2"></stop></linearGradient><path fill="url(#F8F33TU9HxDNWNbQYRyY3a)" d="M28,5v9c0,1.105,0.895,2,2,2h9L28,5z"></path></svg> ${item.name}<span class="badge-info badge-pill float-right csize"> ${item['size']}</span><span class="badge-primary badge-pill float-right cmtime">${item['modifiedTime']}</span></a>`;
		}
	}

	// When it is page 1, remove the horizontal loading bar
	$list.html(($list.data('curPageIndex') == '0' ? '' : $list.html()) + html);
	// When it is the last page, count and display the total number of items
	if (is_lastpage_loaded) {
		$('#count').removeClass('mdui-hidden').find('.number').text($list.find('li.mdui-list-item').length);
	}
}

/**
 * Search result item click event
 * @param a_ele Clicked element
 */
function onSearchResultItemClick(a_ele) {
	var me = $(a_ele);
	var can_preview = me.hasClass('view');
	var cur = window.current_drive_order;
	var dialog = mdui.dialog({
		title: '',
		content: '<div class="mdui-text-center mdui-typo-title mdui-m-b-1">Getting target path...</div><div class="d-flex justify-content-center"><div class="spinner-border m-5 text-primary" role="status"><span class="sr-only">Loading...</span></div></div>',
		history: false,
		modal: true,
		closeOnEsc: true
	});
	mdui.updateSpinners();

	// Request a path
	$.post(`/${cur}:id2path`, {
		id: a_ele.id
	}, function (data) {
		if (data) {
			dialog.close();
			var href = `/${cur}:${data}${can_preview ? '?a=view' : ''}`;
			if (href.endsWith("/")) {
				hrefurl = href;
				window.location.assign(hrefurl)
			} else {
				hrefurl = href + '?a=view';
				window.location.assign(hrefurl)
			}

			return;
		}
		dialog.close();
		dialog = mdui.dialog({
			title: 'Failed to get the target path',
			content: 'It may be because this item does not exist in the disc! It may also be because the file [Shared with me] has not been added to Personal Drive!',
			history: false,
			modal: true,
			closeOnEsc: true,
			buttons: [{
				text: 'WTF ???'
			}]
		});
	})
}
function get_file(path, file, callback) {
	var key = "file_path_" + path + file['modifiedTime'];
	var data = localStorage.getItem(key);
	if (data != undefined) {
		return callback(data);
	} else {
		$.get(path, function (d) {
			localStorage.setItem(key, d);
			callback(d);
		});
	}
}


// File display ?a=view
function file(path) {
	var name = path.split('/').pop();
	var ext = name.split('.').pop().toLowerCase().replace(`?a=view`, "").toLowerCase();
	if ("|html|php|css|go|java|js|json|txt|sh|md|".indexOf(`|${ext}|`) >= 0) {
		return file_code(path);
	}

	if ("|mp4|webm|avi|".indexOf(`|${ext}|`) >= 0) {
		return file_video(path);
	}

	if ("|mpg|mpeg|mkv|rm|rmvb|mov|wmv|asf|ts|flv|".indexOf(`|${ext}|`) >= 0) {
		return file_video(path);
	}

	if ("|mp3|flac|wav|ogg|m4a|".indexOf(`|${ext}|`) >= 0) {
		return file_audio(path);
	}

	if ("|bmp|jpg|jpeg|png|gif|".indexOf(`|${ext}|`) >= 0) {
		return file_image(path);
	}
	else {
		return file_others(path);
	}

	if ('pdf' === ext) return file_pdf(path);
}

// Document display |zip|.exe/others direct downloads
function file_others(path) {
	var type = {
		"zip": "zip",
		"exe": "exe",
		"rar": "rar",
	};
	var name = path.split('/').pop();
	var ext = name.split('.').pop().toLowerCase();
	var pathenco = encodeURI(path);
	var href = window.location.origin + pathenco;
	var content = `
<div class="container"><br>
<div class="card">
<div class="card-body">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
</div>
<p class="card-text text-center"><a href="${href}" class="btnx-primary">Download</a></p><br>`;
	$('#content').html(content);
}

// Document display |html|php|css|go|java|js|json|txt|sh|md|
function file_code(path) {
	var type = {
		"html": "html",
		"php": "php",
		"css": "css",
		"go": "golang",
		"java": "java",
		"js": "javascript",
		"json": "json",
		"txt": "Text",
		"sh": "sh",
		"md": "Markdown",
	};
	var name = path.split('/').pop();
	var ext = name.split('.').pop().toLowerCase();
	var pathenco = encodeURI(path);
	var href = window.location.origin + pathenco;
	var content = `
<div class="container"><br>
<div class="card">
<div class="card-body">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
<code id="editor" class="card-text"></code>
</div>
<p class="card-text text-center"><a href="${href}" class="btnx-primary">Download</a></p><br>`;
	$('#content').html(content);

	$.get(path, function (data) {
		$('#editor').html($('<div/><div/><div/>').text(data).html());
		var code_type = "Text";
		if (type[ext] != undefined) {
			code_type = type[ext];
		}
	});
}

function copyToClipboard(str) {
	const $temp = $("<input>");
	$("body").append($temp);
	$temp.val(str).select();
	document.execCommand("copy");
	$temp.remove();
}

// Document display video |mp4|webm|avi|
function file_video(path) {
	const pathenco = encodeURI(path);
	const url = window.location.origin + pathenco;
	const content = `
  <div class="container"><br>
  <div class="card">
  <div class="card-body text-center">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
  
  </div>

  <p class="card-text text-center"><a href="${url}" class="btnx-primary">Download</a></p><br>
  </div>
  </div>
  `;
	$('#content').html(content);
}

// File display Audio |mp3|flac|m4a|wav|ogg|
function file_audio(path) {
	var url = window.location.origin + path;
	var content = `
  <div class="container"><br>
  <div class="card">
  <div class="card-body text-center">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
  <audio id="bPlayer" width="100%" controls>
    <source src="${url}" type="audio/ogg">
    <source src="${url}" type="audio/mpeg">
  Your browser does not support the audio element.
  </audio>
  </div>
	${UI.disable_player ? '<style>#mep_0{display:none;}</style>' : ''}
  <script type="text/javascript">$('#bPlayer').mediaelementplayer();</script>
  <p class="card-text text-center"><a href="${url}" class="btnx-primary">Download</a></p><br>
  </div>
  </div>
  `;
	$('#content').html(content);
}

// Document display pdf  pdf
function file_pdf(path) {
	const url = window.location.origin + path;
	const inline_url = `${url}?inline=true`
	const file_name = decodeURI(path.slice(path.lastIndexOf('/') + 1, path.length))
	var content = `
  <div class="container"><br>
  <div class="card">
  <div class="card-body text-center">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
  <object data="${inline_url}" type="application/pdf" name="${file_name}" style="width:100%;height:94vh;"><embed src="${inline_url}" type="application/pdf"/></object>
  </div>
  <p class="card-text text-center"><a href="${url}" class="btnx-primary">Download</a></p><br>
  </div>
  </div>
  `;
	$('#content').removeClass('mdui-container').addClass('mdui-container-fluid').css({
		padding: 0
	}).html(content);
}

// image display
function file_image(path) {
	var url = window.location.origin + path;
	var durl = decodeURI(url);
	// console.log(window.location.pathname)
	const currentPathname = window.location.pathname
	const lastIndex = currentPathname.lastIndexOf('/');
	const fatherPathname = currentPathname.slice(0, lastIndex + 1);
	// console.log(fatherPathname)
	let target_children = localStorage.getItem(fatherPathname);
	// console.log(`fatherPathname: ${fatherPathname}`);
	// console.log(target_children)
	let targetText = '';
	if (target_children) {
		try {
			target_children = JSON.parse(target_children);
			if (!Array.isArray(target_children)) {
				target_children = []
			}
		} catch (e) {
			console.error(e);
			target_children = [];
		}
		// <div id="btns" >
		//             ${targetObj[path].prev ? `<span id="leftBtn" data-direction="left" data-filepath="${targetObj[path].prev}"><i class="mdui-icon material-icons"></i><span style="margin-left: 10px;">Prev</span></span>` : `<span style="cursor: not-allowed;color: rgba(0,0,0,0.2);margin-bottom:20px;"><i class="mdui-icon material-icons"></i><span style="margin-left: 10px;">Prev</span></span>`}
		//             ${targetObj[path].next ? `<span id="rightBtn" data-direction="right"  data-filepath="${targetObj[path].next}"><i class="mdui-icon material-icons"></i><span style="margin-left: 10px;">Next</span></span>` : `<span style="cursor: not-allowed;color: rgba(0,0,0,0.2);"><i class="mdui-icon material-icons"></i><span style="margin-left: 10px;">Prev</span></span>`}
		// </div>
	}
	var content = `
  <div class="container"><br>
  <div class="card">
  <div class="card-body text-center">
  <div class="alert alert-danger" id="folderne" role="alert"></div><script>document.getElementById("folderne").innerHTML=decodeURI(this.window.location.href.substring(window.location.href.lastIndexOf('/',window.location.href.lastIndexOf('/')+1))).replace('/','').replace('?a=view','');</script>
  <img src="${url}" width="50%">
  </div>
  <p class="card-text text-center"><a href="${url}" class="btnx-primary">Download</a></p><br>
  </div>
  </div>
    `;
	// my code
	$('#content').html(content);
	$('#leftBtn, #rightBtn').click((e) => {
		let target = $(e.target);
		if (['I', 'SPAN'].includes(e.target.nodeName)) {
			target = $(e.target).parent();
		}
		const filepath = target.attr('data-filepath');
		const direction = target.attr('data-direction');
		//console.log(`${direction}Turn page ${filepath}`);
		file(filepath)
	});
}


// Time conversion
function utc2beijing(utc_datetime) {
	// Convert to normal time format year-month-day hour: minute: second
	var T_pos = utc_datetime.indexOf('T');
	var Z_pos = utc_datetime.indexOf('Z');
	var year_month_day = utc_datetime.substr(0, T_pos);
	var hour_minute_second = utc_datetime.substr(T_pos + 1, Z_pos - T_pos - 1);
	var new_datetime = year_month_day + " " + hour_minute_second; // 2017-03-31 08:02:06

	// Processing becomes timestamp
	timestamp = new Date(Date.parse(new_datetime));
	timestamp = timestamp.getTime();
	timestamp = timestamp / 1000;

	// 8 hours increase, Beijing time is eight more time zones than UTC time
	var unixtimestamp = timestamp + 5.5 * 60 * 60;

	// Timestamp to time
	var unixtimestamp = new Date(unixtimestamp * 1000);
	var year = 1900 + unixtimestamp.getYear();
	var month = "0" + (unixtimestamp.getMonth() + 1);
	var date = "0" + unixtimestamp.getDate();
	var hour = "0" + unixtimestamp.getHours();
	var minute = "0" + unixtimestamp.getMinutes();
	var second = "0" + unixtimestamp.getSeconds();
	return year + "-" + month.substring(month.length - 2, month.length) + "-" + date.substring(date.length - 2, date.length) +
		" " + hour.substring(hour.length - 2, hour.length) + ":" +
		minute.substring(minute.length - 2, minute.length) + ":" +
		second.substring(second.length - 2, second.length);
}

// bytes adaptive conversion to KB, MB, GB
function formatFileSize(bytes) {
	if (bytes >= 1000000000) {
		bytes = (bytes / 1000000000).toFixed(2) + ' GB';
	} else if (bytes >= 1000000) {
		bytes = (bytes / 1000000).toFixed(2) + ' MB';
	} else if (bytes >= 1000) {
		bytes = (bytes / 1000).toFixed(2) + ' KB';
	} else if (bytes > 1) {
		bytes = bytes + ' bytes';
	} else if (bytes == 1) {
		bytes = bytes + ' byte';
	} else {
		bytes = '';
	}
	return bytes;
}

String.prototype.trim = function (char) {
	if (char) {
		return this.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
	}
	return this.replace(/^\s+|\s+$/g, '');
};


// README.md HEAD.md support
function markdown(el, data) {
	if (window.md == undefined) {
		//$.getScript('https://cdn.jsdelivr.net/npm/markdown-it@10.0.0/dist/markdown-it.min.js',function(){
		window.md = window.markdownit();
		markdown(el, data);
		//});
	} else {
		var html = md.render(data);
		$(el).show().html(html);
	}
}

// Listen for fallback events
window.onpopstate = function () {
	var path = window.location.pathname;
	render(path);
}


$(function () {
	init();
	var path = window.location.pathname;
	/*$("body").on("click", '.folder', function () {
	    var url = $(this).attr('href');
	    history.pushState(null, null, url);
	    render(url);
	    return false;
	});

	$("body").on("click", '.view', function () {
	    var url = $(this).attr('href');
	    history.pushState(null, null, url);
	    render(url);
	    return false;
	});*/

	render(path);
});
