module.exports = {
  stylesheet: ['.report-style.css'],
  pdf_options: {
    format: 'Letter',
    margin: {
      top: '1.4in',
      right: '1.25in',
      bottom: '1.4in',
      left: '1.25in',
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate:
      '<div style="font-size:9pt;width:100%;text-align:center;color:#888;font-family:-apple-system,Helvetica,sans-serif;"><span class="pageNumber"></span></div>',
  },
};
